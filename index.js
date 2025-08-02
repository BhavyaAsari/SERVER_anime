require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const app = express();

const PORT = process.env.PORT || 3000;

// ✅ Must declare first before using
const isProduction = process.env.NODE_ENV === 'production';

// ✅ Updated allowedOrigins to include your frontend URL
const allowedOrigins = isProduction
  ? ['https://animehub-one.vercel.app']
  : [
      'http://localhost:5173', 
      'http://localhost:3500', 
      'http://localhost:5500',
      'http://127.0.0.1:5500',  // Sometimes Live Server uses 127.0.0.1
      'null' // For file:// protocol during development
    ];

// ✅ CORS setup with better error handling
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// ✅ Handle preflight requests
// 
// cloudinary.config();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Session handling with updated configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret_change_in_production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    httpOnly: true,
    secure: isProduction, // Only secure in production
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));



// ✅ MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err));

// ✅ Serve static files (if any)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/one-on-one', require('./routes/DirectMessageRoute'));
app.use('/api/messages', require('./routes/MessageRoute'));

// ✅ HTTP + WebSocket server
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: isProduction
      ? ["https://animehub-one.vercel.app"]
      : [
          "http://localhost:5500",
          "http://localhost:5173", 
          "http://localhost:3500",
          "http://127.0.0.1:5500"
        ],
    credentials: true,
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('sendMessage', (data) => {
    const {
      chatId, content, senderId, senderName, username,
      profilePicture, receiverId
    } = data;

    io.to(chatId).emit('receiveMessage', {
      chatId,
      content,
      senderId,
      senderName: senderName || username,
      username: username || senderName,
      profilePicture,
      receiverId,
      timestamp: new Date(),
    });

  });

  socket.on('disconnect', () => {
  });
});

// ✅ Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Your AnimeHub backend is working!',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development'
  });
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error(' Server Error:', err.message);
  res.status(err.status || 500).json({
    error: isProduction ? 'Internal Server Error' : err.message
  });
});

// ✅ Start server
server.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);

});