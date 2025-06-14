const express = require('express');
const router = express.Router();
const path = require('path');
const isLoggedIn = require('../MiddleWare/middleware');
const DirectMessage = require('../models/DirectMessage');
const Message = require('../models/ChatModel');
const { uploadGeneral, handleMulterError } = require('../Config/multerConfig');

// ✅ Send message with optional image upload
router.post('/', isLoggedIn, uploadGeneral.single('image'), handleMulterError, async (req, res) => {
  try {
    const { chat, content } = req.body;
    const sender = req.session.user._id;
    
    // Handle uploaded image
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/general/${req.file.filename}`;
    }

    if (!chat) {
      return res.status(400).json({ error: "chat ID is required." });
    }

    if (!content && !imageUrl) {
      return res.status(400).json({ error: "Message content or image is required." });
    }

    // Verify the DirectMessage exists and user is a participant
    const directMessage = await DirectMessage.findById(chat);
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
      chatModel: "DirectMessage", // Fixed to always be DirectMessage
      content: content || '',
      imageUrl,
      status: "sent",
      readBy: [sender],
    });

    const saved = await message.save();

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
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get messages for a chat
router.get('/chat/:chatId', isLoggedIn, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.session.user._id;

    // Verify the DirectMessage exists and user is a participant
    const directMessage = await DirectMessage.findById(chatId);
    if (!directMessage) {
      return res.status(404).json({ error: "Chat not found." });
    }

    // Check if user is a participant
    const isParticipant = directMessage.participants.some(
      participant => participant.toString() === userId.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({ error: "Not authorized to view this chat." });
    }

    const messages = await Message.find({ 
      chat: chatId,
      chatModel: "DirectMessage"
    })
      .populate("sender", "username profilePicture avatar")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Mark a message as read
router.patch('/:messageId/read', isLoggedIn, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.session.user._id;

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
    const userId = req.session.user._id;
    const messageId = req.params.messageId;

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