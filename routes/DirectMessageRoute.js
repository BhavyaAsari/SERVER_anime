const express = require('express');
const router = express.Router();
const DirectMessage = require('../models/DirectMessage');
const Message = require('../models/ChatModel'); // Assuming you have a Message model
const isloggedIn = require('../MiddleWare/middleware');

// ✅ Create or get existing one-on-one chat
router.post('/', isloggedIn, async (req, res) => {
  const userId = req.session.user._id;
  const { otherUserId } = req.body;

  console.log("userId from session:", userId);
  console.log("otherUserId from request body:", otherUserId);

  if (!userId || !otherUserId) {
    return res.status(400).json({ message: "Both userId and otherUserId are required" });
  }

  try {
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
    const formattedChat = {
      ...chat.toObject(),
      otherUser: chat.members.find(member => member._id.toString() !== userId.toString()),
      currentUser: chat.members.find(member => member._id.toString() === userId.toString())
    };

    res.status(200).json(formattedChat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get chat list with proper profile population
router.get('/chatlist', isloggedIn, async (req, res) => {
  const userId = req.session.user._id;

  try {
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
        otherUser,
        // Add profile picture URL if it exists
        otherUserProfilePic: otherUser?.profilePicture ? 
          `/uploads/profile-pics/${otherUser.profilePicture.split('/').pop()}` : null
      };
    });

    res.status(200).json(formattedChats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get messages for a specific chat with sender profile pictures
router.get('/:chatId/messages', isloggedIn, async (req, res) => {
  const userId = req.session.user._id;
  const { chatId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  try {
    // Verify user is member of this chat
    const chat = await DirectMessage.findOne({
      _id: chatId,
      members: userId
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found or access denied" });
    }

    // Get messages with sender profile pictures
    const messages = await Message.find({ chatId })
      .populate({
        path: "sender",
        select: "username profilePicture email _id"
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Format messages with profile picture URLs
    const formattedMessages = messages.reverse().map(message => ({
      ...message.toObject(),
      senderProfilePic: message.sender?.profilePicture ? 
        `PUBLIC/uploads/profile-pics/${message.sender.profilePicture.split('/').pop()}` : null
    }));

    res.status(200).json({
      messages: formattedMessages,
      currentPage: parseInt(page),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Send message in chat
router.post('/:chatId/messages', isloggedIn, async (req, res) => {
  const userId = req.session.user._id;
  const { chatId } = req.params;
  const { content, messageType = 'text' } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Message content is required" });
  }

  try {
    // Verify user is member of this chat
    const chat = await DirectMessage.findOne({
      _id: chatId,
      members: userId
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found or access denied" });
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
        `/uploads/profile-pics/${message.sender.profilePicture.split('/').pop()}` : null
    };

    res.status(201).json(formattedMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;