const express = require('express');
const router = express.Router();
const DirectMessage = require('../models/DirectMessage');
const Message = require('../models/ChatModel');
const isloggedIn = require('../MiddleWare/middleware');
const mongoose = require('mongoose');

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper function to safely get profile picture URL
const getProfilePicUrl = (profilePicture) => {
  if (!profilePicture) return null;
  
  // Handle different formats of profile picture paths
  if (profilePicture.startsWith('http')) {
    return profilePicture;
  }
  
  // Extract filename from path
  const filename = profilePicture.split('/').pop();
  return `/uploads/profile-pics/${filename}`;
};

// ✅ Create or get existing one-on-one chat
router.post('/', isloggedIn, async (req, res) => {
  try {
    const userId = req.session?.user?._id;
    const { otherUserId } = req.body;

    console.log("userId from session:", userId);
    console.log("otherUserId from request body:", otherUserId);

    // Validate required fields
    if (!userId || !otherUserId) {
      return res.status(400).json({ 
        success: false,
        message: "Both userId and otherUserId are required" 
      });
    }

    // Validate ObjectIds
    if (!isValidObjectId(userId) || !isValidObjectId(otherUserId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid user IDs provided" 
      });
    }

    // Don't allow chat with yourself
    if (userId.toString() === otherUserId.toString()) {
      return res.status(400).json({ 
        success: false,
        message: "Cannot create chat with yourself" 
      });
    }

    let chat = await DirectMessage.findOne({
      members: { $all: [userId, otherUserId], $size: 2 },
    }).populate("members", "username profilePicture email _id");

    if (!chat) {
      chat = new DirectMessage({
        members: [userId, otherUserId],
      });

      await chat.save();
      await chat.populate("members", "username profilePicture email _id");
    }

    // Format response with user info for easy frontend access
    const otherUser = chat.members.find(member => member._id.toString() !== userId.toString());
    const currentUser = chat.members.find(member => member._id.toString() === userId.toString());

    const formattedChat = {
      ...chat.toObject(),
      otherUser: otherUser ? {
        ...otherUser.toObject(),
        profilePicture: getProfilePicUrl(otherUser.profilePicture)
      } : null,
      currentUser: currentUser ? {
        ...currentUser.toObject(),
        profilePicture: getProfilePicUrl(currentUser.profilePicture)
      } : null
    };

    res.status(200).json({
      success: true,
      data: formattedChat
    });
  } catch (err) {
    console.error('Error in POST /:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while creating/getting chat",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Get chat list with proper profile population
router.get('/chatlist', isloggedIn, async (req, res) => {
  try {
    const userId = req.session?.user?._id;

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid user ID" 
      });
    }

    const chats = await DirectMessage.find({
      members: userId,
    })
      .populate("members", "username profilePicture email _id")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "username profilePicture email _id",
        },
      })
      .sort({ updatedAt: -1 });

    // Format chats to include otherUser info for easy frontend access
    const formattedChats = chats.map(chat => {
      const otherUser = chat.members.find(member => 
        member._id.toString() !== userId.toString()
      );
      
      return {
        ...chat.toObject(),
        otherUser: otherUser ? {
          ...otherUser.toObject(),
          profilePicture: getProfilePicUrl(otherUser.profilePicture)
        } : null,
        // Keep backward compatibility
        otherUserProfilePic: otherUser?.profilePicture ? 
          getProfilePicUrl(otherUser.profilePicture) : null
      };
    });

    res.status(200).json({
      success: true,
      data: formattedChats
    });
  } catch (err) {
    console.error('Error in GET /chatlist:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while fetching chat list",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Get messages for a specific chat with sender profile pictures
router.get('/:chatId/messages', isloggedIn, async (req, res) => {
  try {
    const userId = req.session?.user?._id;
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    // Validate ObjectIds
    if (!isValidObjectId(userId) || !isValidObjectId(chatId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid user ID or chat ID" 
      });
    }

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 messages per request

    // Verify user is member of this chat
    const chat = await DirectMessage.findOne({
      _id: chatId,
      members: userId
    });

    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found or access denied" 
      });
    }

    // Get messages with sender profile pictures
    const messages = await Message.find({ chatId })
      .populate({
        path: "sender",
        select: "username profilePicture email _id"
      })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    // Format messages with profile picture URLs
    const formattedMessages = messages.reverse().map(message => ({
      ...message.toObject(),
      senderProfilePic: message.sender?.profilePicture ? 
        getProfilePicUrl(message.sender.profilePicture) : null
    }));

    res.status(200).json({
      success: true,
      data: {
        messages: formattedMessages,
        currentPage: pageNum,
        hasMore: messages.length === limitNum,
        totalMessages: formattedMessages.length
      }
    });
  } catch (err) {
    console.error('Error in GET /:chatId/messages:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while fetching messages",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Send message in chat
router.post('/:chatId/messages', isloggedIn, async (req, res) => {
  try {
    const userId = req.session?.user?._id;
    const { chatId } = req.params;
    const { content, messageType = 'text' } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    // Validate ObjectIds
    if (!isValidObjectId(userId) || !isValidObjectId(chatId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid user ID or chat ID" 
      });
    }

    // Validate message content
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Message content is required" 
      });
    }

    // Validate message type
    const validMessageTypes = ['text', 'image', 'file', 'emoji'];
    if (!validMessageTypes.includes(messageType)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid message type" 
      });
    }

    // Verify user is member of this chat
    const chat = await DirectMessage.findOne({
      _id: chatId,
      members: userId
    });

    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found or access denied" 
      });
    }

    // Create new message
    const message = new Message({
      chatId,
      sender: userId,
      content: content.trim(),
      messageType
    });

    await message.save();
    
    // Populate sender info including profile picture
    await message.populate({
      path: "sender",
      select: "username profilePicture email _id"
    });

    // Update chat's lastMessage and updatedAt
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    await chat.save();

    // Format response with profile picture URL
    const formattedMessage = {
      ...message.toObject(),
      senderProfilePic: message.sender?.profilePicture ? 
        getProfilePicUrl(message.sender.profilePicture) : null
    };

    res.status(201).json({
      success: true,
      data: formattedMessage
    });
  } catch (err) {
    console.error('Error in POST /:chatId/messages:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while sending message",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Delete a message (optional enhancement)
router.delete('/:chatId/messages/:messageId', isloggedIn, async (req, res) => {
  try {
    const userId = req.session?.user?._id;
    const { chatId, messageId } = req.params;

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    // Validate ObjectIds
    if (!isValidObjectId(userId) || !isValidObjectId(chatId) || !isValidObjectId(messageId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid IDs provided" 
      });
    }

    // Verify user is member of this chat
    const chat = await DirectMessage.findOne({
      _id: chatId,
      members: userId
    });

    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found or access denied" 
      });
    }

    // Find and verify message ownership
    const message = await Message.findOne({
      _id: messageId,
      chatId: chatId,
      sender: userId
    });

    if (!message) {
      return res.status(404).json({ 
        success: false,
        message: "Message not found or you don't have permission to delete it" 
      });
    }

    await Message.findByIdAndDelete(messageId);

    res.status(200).json({
      success: true,
      message: "Message deleted successfully"
    });
  } catch (err) {
    console.error('Error in DELETE /:chatId/messages/:messageId:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while deleting message",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;