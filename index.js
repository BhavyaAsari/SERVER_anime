require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5500',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Session middleware
app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'defaultSecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60,
  }
}));

// ✅ MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection failed:", err));

// ✅ Static files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/one-on-one', require('./routes/DirectMessageRoute'));
app.use('/api/messages', require('./routes/MessageRoute'));

// ✅ Socket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5500",
    credentials: true,
  }
});

io.on('connection', (socket) => {
  console.log('A user connected with id: ', socket.id);

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`User joined private room: ${chatId}`);
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

    console.log(`Message sent in room ${chatId} by ${senderName || username}`);
  });

  socket.on('disconnect', () => {
    console.log("A user disconnected: ", socket.id);
  });
});

// ✅ Health route
app.get('/', (req, res) => {
  res.send(' Your AnimeHub backend is working!');
});

// ✅ Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
