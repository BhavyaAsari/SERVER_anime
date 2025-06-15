const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const isLoggedIn = require('../MiddleWare/middleware');
const DirectMessage = require('../models/DirectMessage');
const Message = require('../models/ChatModel');
const { uploadGeneral, handleMulterError, deleteFile } = require('../Config/multerConfig');

// ✅ Get messages for a chat - IMPROVED VERSION (No changes needed)
router.get('/chat/:chatId', isLoggedIn, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    
    console.log('Fetching messages for chatId:', chatId);
    console.log('User session:', req.session?.user?._id);
    
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      console.log('Invalid ObjectId format:', chatId);
      return res.status(400).json({ error: "Invalid chat ID format." });
    }

    if (!req.session?.user?._id) {
      console.log('No user in session');
      return res.status(401).json({ error: "User not authenticated." });
    }

    const userId = req.session.user._id;
    console.log('Authenticated user:', userId);

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

    let messages;
    try {
      messages = await Message.find({ 
        chat: chatId,
        chatModel: "DirectMessage"
      })
        .populate("sender", "username profilePicture avatar")
        .sort({ createdAt: 1 })
        .lean();

      console.log('Messages found:', messages.length);
    } catch (dbError) {
      console.error('Database error fetching messages:', dbError);
      return res.status(500).json({ error: "Error fetching messages from database." });
    }

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

// ✅ Send message with optional image upload - UPDATED FOR CLOUDINARY
router.post('/', isLoggedIn, uploadGeneral.single('image'), handleMulterError, async (req, res) => {
  try {
    const { chat, content } = req.body;
    
    if (!req.session?.user?._id) {
      return res.status(401).json({ error: "User not authenticated." });
    }
    
    const sender = req.session.user._id;
    
    console.log('Sending message to chat:', chat, 'from user:', sender);
    
    // ✅ UPDATED: Handle uploaded image from Cloudinary
    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path; // Cloudinary URL instead of local path
      console.log('Image uploaded to Cloudinary:', imageUrl);
    }

    if (!chat || !mongoose.Types.ObjectId.isValid(chat)) {
      return res.status(400).json({ error: "Valid chat ID is required." });
    }

    if (!content && !imageUrl) {
      return res.status(400).json({ error: "Message content or image is required." });
    }

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

    await DirectMessage.findByIdAndUpdate(chat, { 
      lastMessage: saved._id,
      updatedAt: new Date()
    });

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

// ✅ Mark a message as read (No changes needed)
router.patch('/:messageId/read', isLoggedIn, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    
    if (!req.session?.user?._id) {
      return res.status(401).json({ error: "User not authenticated." });
    }
    
    const userId = req.session.user._id;

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

// ✅ Delete a message - UPDATED FOR CLOUDINARY
router.delete('/:messageId', isLoggedIn, async (req, res) => {
  try {
    if (!req.session?.user?._id) {
      return res.status(401).json({ error: "User not authenticated." });
    }
    
    const userId = req.session.user._id;
    const messageId = req.params.messageId;

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

    // ✅ UPDATED: Delete image from Cloudinary instead of local filesystem
    if (message.imageUrl) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = message.imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = `animehub/general/${filename.split('.')[0]}`;
        
        await deleteFile(publicId);
        console.log('Image deleted from Cloudinary:', publicId);
      } catch (deleteError) {
        console.error('Error deleting image from Cloudinary:', deleteError);
        // Continue with message deletion even if image deletion fails
      }
    }

    await Message.findByIdAndDelete(messageId);

    // Update lastMessage in DirectMessage if this was the last message
    const directMessage = await DirectMessage.findById(message.chat);
    if (directMessage && directMessage.lastMessage && directMessage.lastMessage.toString() === messageId) {
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