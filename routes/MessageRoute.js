const express = require('express');
const router = express.Router();
const isLoggedIn = require('../MiddleWare/middleware');
const DirectMessage = require('../models/DirectMessage');
const Message = require('../models/ChatModel');
const { uploadGeneral, handleMulterError } = require('../Config/multerConfig'); // Assuming multer config is in config folder

// ✅ Send message with optional image upload
router.post('/', isLoggedIn, uploadGeneral.single('image'), handleMulterError, async (req, res) => {
  try {
    const { chat, chatModel, content } = req.body;
    const sender = req.session.user._id;
    
    // Handle uploaded image
    let imageUrl = null;
    if (req.file) {
      // Create the URL path for the uploaded image
      imageUrl = `/uploads/general/${req.file.filename}`;
    }

    if (!chat || !chatModel) {
      return res.status(400).json({ error: "chat and chatModel are required." });
    }

    if (!content && !imageUrl) {
      return res.status(400).json({ error: "Message content or image is required." });
    }

    const message = new Message({
      sender,
      chat,
      chatModel,
      content: content || '', // Allow empty content if image is provided
      imageUrl,
      status: "sent",
      readBy: [sender],
    });

    const saved = await message.save();

    // Update the lastMessage in the corresponding chat model
    if (chatModel === "DirectMessage") {
      await DirectMessage.findByIdAndUpdate(chat, { lastMessage: saved._id });
    } else if (chatModel === "GroupChat") {
      await GroupChat.findByIdAndUpdate(chat, { lastMessage: saved._id });
    } else if (chatModel === "Chat") {
      await Chat.findByIdAndUpdate(chat, { lastMessage: saved._id });
    }

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
    const messages = await Message.find({ chat: chatId })
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

    const updated = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: userId }, status: "read" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Message not found" });
    }

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

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

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
    res.json({ success: true, message: "Message deleted successfully" });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;