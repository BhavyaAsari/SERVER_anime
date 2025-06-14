const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose'); // Add this import
const isLoggedIn = require('../MiddleWare/middleware');
const DirectMessage = require('../models/DirectMessage');
const Message = require('../models/ChatModel');
const { uploadGeneral, handleMulterError } = require('../Config/multerConfig');

// ✅ Get messages for a chat - IMPROVED VERSION
router.get('/chat/:chatId', isLoggedIn, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    
    // ✅ Add detailed logging
    console.log('Fetching messages for chatId:', chatId);
    console.log('User session:', req.session?.user?._id);
    
    // ✅ Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      console.log('Invalid ObjectId format:', chatId);
      return res.status(400).json({ error: "Invalid chat ID format." });
    }

    // ✅ Check session user exists
    if (!req.session?.user?._id) {
      console.log('No user in session');
      return res.status(401).json({ error: "User not authenticated." });
    }

    const userId = req.session.user._id;
    console.log('Authenticated user:', userId);

    // ✅ Add try-catch for database operations
    let directMessage;
    try {
      directMessage = await DirectMessage.findById(chatId);
      console.log('DirectMessage found:', !!directMessage);
    } catch (dbError) {
      console.error('Database error finding DirectMessage:', dbError);
      return res.status(500).json({ error: "Database error occurred." });
    }

    if (!directMessage) {
      console.log('Chat not found in database');
      return res.status(404).json({ error: "Chat not found." });
    }

    // ✅ Check if user is a participant with better logging
    const isParticipant = directMessage.participants.some(
      participant => {
        const participantId = participant.toString();
        const currentUserId = userId.toString();
        console.log('Comparing participant:', participantId, 'with user:', currentUserId);
        return participantId === currentUserId;
      }
    );
    
    console.log('Is user a participant?', isParticipant);
    
    if (!isParticipant) {
      console.log('User not authorized for this chat');
      return res.status(403).json({ error: "Not authorized to view this chat." });
    }

    // ✅ Fetch messages with error handling
    let messages;
    try {
      messages = await Message.find({ 
        chat: chatId,
        chatModel: "DirectMessage"
      })
        .populate("sender", "username profilePicture avatar")
        .sort({ createdAt: 1 })
        .lean(); // Add lean() for better performance

      console.log('Messages found:', messages.length);
    } catch (dbError) {
      console.error('Database error fetching messages:', dbError);
      return res.status(500).json({ error: "Error fetching messages from database." });
    }

    // ✅ Validate populated data
    const validMessages = messages.map(msg => ({
      ...msg,
      sender: msg.sender || { username: 'Unknown User', profilePicture: null, avatar: null }
    }));

    res.json(validMessages);
  } catch (err) {
    console.error("Unexpected error in /chat/:chatId route:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Send message with optional image upload - IMPROVED VERSION
router.post('/', isLoggedIn, uploadGeneral.single('image'), handleMulterError, async (req, res) => {
  try {
    const { chat, content } = req.body;
    
    // ✅ Add session validation
    if (!req.session?.user?._id) {
      return res.status(401).json({ error: "User not authenticated." });
    }
    
    const sender = req.session.user._id;
    
    console.log('Sending message to chat:', chat, 'from user:', sender);
    
    // Handle uploaded image
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/general/${req.file.filename}`;
      console.log('Image uploaded:', imageUrl);
    }

    // ✅ Validate chat ID format
    if (!chat || !mongoose.Types.ObjectId.isValid(chat)) {
      return res.status(400).json({ error: "Valid chat ID is required." });
    }

    if (!content && !imageUrl) {
      return res.status(400).json({ error: "Message content or image is required." });
    }

    // ✅ Verify the DirectMessage exists and user is a participant
    let directMessage;
    try {
      directMessage = await DirectMessage.findById(chat);
    } catch (dbError) {
      console.error('Database error finding DirectMessage:', dbError);
      return res.status(500).json({ error: "Database error occurred." });
    }

    if (!directMessage) {
      return res.status(404).json({ error: "Chat not found." });
    }

    // Check if user is a participant in this chat
    const isParticipant = directMessage.participants.some(
      participant => participant.toString() === sender.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({ error: "Not authorized to send messages in this chat." });
    }

    const message = new Message({
      sender,
      chat,
      chatModel: "DirectMessage",
      content: content || '',
      imageUrl,
      status: "sent",
      readBy: [sender],
    });

    const saved = await message.save();
    console.log('Message saved:', saved._id);

    // Update the lastMessage in DirectMessage
    await DirectMessage.findByIdAndUpdate(chat, { 
      lastMessage: saved._id,
      updatedAt: new Date()
    });

    // Populate sender info for the response
    const populatedMessage = await Message.findById(saved._id)
      .populate("sender", "username profilePicture avatar");

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error("Error sending message:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Keep your other routes (mark as read, delete) as they are...
// ✅ Mark a message as read
router.patch('/:messageId/read', isLoggedIn, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    
    if (!req.session?.user?._id) {
      return res.status(401).json({ error: "User not authenticated." });
    }
    
    const userId = req.session.user._id;

    // Validate messageId format
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid message ID format." });
    }

    // Find the message and verify it's a DirectMessage
    const message = await Message.findOne({
      _id: messageId,
      chatModel: "DirectMessage"
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is participant in the chat
    const directMessage = await DirectMessage.findById(message.chat);
    if (!directMessage) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const isParticipant = directMessage.participants.some(
      participant => participant.toString() === userId.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({ error: "Not authorized to mark this message as read" });
    }

    const updated = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: userId }, status: "read" },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("Error updating message status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Delete a message (only sender can delete)
router.delete('/:messageId', isLoggedIn, async (req, res) => {
  try {
    if (!req.session?.user?._id) {
      return res.status(401).json({ error: "User not authenticated." });
    }
    
    const userId = req.session.user._id;
    const messageId = req.params.messageId;

    // Validate messageId format
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid message ID format." });
    }

    const message = await Message.findOne({
      _id: messageId,
      chatModel: "DirectMessage"
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!message.sender || message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }

    // Delete associated image file if it exists
    if (message.imageUrl) {
      const { deleteFile } = require('../Config/multerConfig');
      const imagePath = path.join(__dirname, '..', 'public', message.imageUrl);
      deleteFile(imagePath);
    }

    await Message.findByIdAndDelete(messageId);

    // Update lastMessage in DirectMessage if this was the last message
    const directMessage = await DirectMessage.findById(message.chat);
    if (directMessage && directMessage.lastMessage && directMessage.lastMessage.toString() === messageId) {
      // Find the previous message to set as lastMessage
      const previousMessage = await Message.findOne({
        chat: message.chat,
        chatModel: "DirectMessage"
      }).sort({ createdAt: -1 });

      await DirectMessage.findByIdAndUpdate(message.chat, {
        lastMessage: previousMessage ? previousMessage._id : null,
        updatedAt: new Date()
      });
    }

    res.json({ success: true, message: "Message deleted successfully" });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;