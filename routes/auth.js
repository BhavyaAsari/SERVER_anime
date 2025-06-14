const express = require("express");
const router = express.Router();
const path = require("path");
const User = require("../models/User");
const isLoggedIn = require("../MiddleWare/middleware");
const { uploadProfilePic, deleteFile, handleMulterError } = require("../Config/multerConfig.js");

// ✅ Signup route
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).send("Email already in use");

    let user = new User({ username, email, password });
    await user.save();

    res.status(201).send("User registered successfully!");
  } catch (error) {
    res.status(400).send("Error: " + error.message);
  }
});

// ✅ Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send("Invalid credentials");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).send("Invalid credentials");

    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
    };

    res.send("Login successful");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// ✅ Get user profile
router.get("/profile", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(404).send("User not found");

    const Review = require("../models/Review");
    const reviewsCount = await Review.countDocuments({ user: user._id });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture || null,
      joinedAt: user.createdAt,
      reviewsPosted: reviewsCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ✅ Upload profile picture - FIXED path handling
router.post(
  "/upload-profile-pic",
  isLoggedIn,
  uploadProfilePic.single("profilePicture"),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = req.session.user._id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // ✅ FIXED: Delete old profile picture if exists
      if (user.profilePicture) {
        const oldPicPath = path.join(__dirname, "..", "public", user.profilePicture);
        await deleteFile(oldPicPath);
      }

      // ✅ FIXED: Store relative path from public directory for serving static files
      const profilePicturePath = `uploads/profile-pics/${req.file.filename}`;
      user.profilePicture = profilePicturePath;

      await user.save();



      res.json({
        message: "Profile picture uploaded successfully",
        profilePicture: profilePicturePath,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("Profile picture upload error:", error);
      res.status(500).json({ error: "Error uploading profile picture" });
    }
  }
);

// ✅ Delete profile picture - FIXED path handling
router.delete("/delete-profile-pic", isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.profilePicture) {
      return res.status(400).json({ error: "No profile picture to delete" });
    }

    // ✅ FIXED: Correct path to delete file from public directory
    const picPath = path.join(__dirname, "..", "public", user.profilePicture);
    await deleteFile(picPath);

    user.profilePicture = null;
    await user.save();

    res.json({ message: "Profile picture deleted successfully" });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    res.status(500).json({ error: "Error deleting profile picture" });
  }
});

// ✅ Update profile
router.post("/update-profile", isLoggedIn, async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.session.user._id;

    if (!username || !email) {
      return res.status(400).send("Username and email are required");
    }

    const existingUser = await User.findOne({
      email,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).send("Email is already taken by another user");
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, email },
      { new: true, runValidators: true }
    );

    if (!updatedUser) return res.status(404).send("User not found");

    req.session.user.username = updatedUser.username;
    req.session.user.email = updatedUser.email;

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).send("Server error while updating profile");
  }
});

// ✅ Get current user info
router.get('/me', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
      .select('username email _id profilePicture');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error getting user info:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Search users
router.get('/search', isLoggedIn, async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.session.user._id;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters' });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        {
          $or: [
            { username: { $regex: q.trim(), $options: 'i' } },
            { email: { $regex: q.trim(), $options: 'i' } }
          ]
        }
      ]
    })
    .select('username email _id profilePicture')
    .limit(10);

    res.json(users);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Logout failed");
    res.clearCookie("connect.sid");
    res.send("Logged out successfully");
  });
});

module.exports = router;