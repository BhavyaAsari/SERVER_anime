const express = require('express');
const router = express.Router();
const isLoggedIn = require('../MiddleWare/middleware');
const GroupChat = require('../models/GroupChatSchema');

// Create new group chat
router.post('/', isLoggedIn, async (req, res) => {
  try {
    const { name, members } = req.body;
    const admin = req.session.user._id; // consistent _id

    const groupChat = new GroupChat({
      name,
      members: [...members, admin],
      admin,
    });

    await groupChat.save();
    res.status(201).json(groupChat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create group chat" });
  }
});

// Get all group chats where user is a member
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const groupChats = await GroupChat.find({ members: userId })
      .populate("members", "username")
      .populate("admin", "username")
      .populate("lastMessage");

    res.json(groupChats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching group chats" });
  }
});

// Get a single group chat by ID
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id)
      .populate("members", "username")
      .populate("admin", "username")
      .populate("lastMessage");

    if (!groupChat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    res.json(groupChat);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Group chat not found" });
  }
});

// Update group chat by ID
router.put('/:id', isLoggedIn, async (req, res) => {
  try {
    const { name, members } = req.body;

    const updated = await GroupChat.findByIdAndUpdate(
      req.params.id,
      { name, members },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update group chat" });
  }
});

// Delete group chat by ID
router.delete('/:id', isLoggedIn, async (req, res) => {
  try {
    const deleted = await GroupChat.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    res.json({ message: "Group chat deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete group chat" });
  }
});

module.exports = router;
