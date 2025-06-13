const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const isLoggedIn = require('../MiddleWare/middleware');
const Review = require('../models/Review');
const { uploadReviewImage, handleMulterError, deleteFile } = require('../Config/multerConfig');

// Helper function to get consistent public directory path
const getPublicPath = () => {
  return path.join(__dirname, '..', 'public');
};
// Helper function to safely delete image files
const safeDeleteImage = (imageUrl) => {
  if (!imageUrl) return false;
  
  try {
    // Remove leading slash if present
    const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
    const fullPath = path.join(getPublicPath(), cleanPath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

// POST: Add review
router.post(
  '/',
  isLoggedIn,
  uploadReviewImage.single('animeImage'),
  handleMulterError,
  async (req, res) => {
    try {
      const userId = req.session.user._id;
      
      if (!userId) return res.status(401).send('Unauthorized');

      const { animeTitle, reviewText, rating } = req.body;

      // Validate required fields
      if (!animeTitle || !reviewText || !rating) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Validate rating
      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      // Handle image path - store relative path without leading slash
const animeImagePath = req.file ? `/uploads/review-images/${req.file.filename}` : '';
      const review = new Review({
        user: userId,
        animeTitle: animeTitle.trim(),
        reviewText: reviewText.trim(),
        rating: ratingNum,
        animeImageUrl: animeImagePath,
      });

      await review.save();
      
      // Populate user info before sending response
      await review.populate('user', 'username');
      
      console.log('Review saved successfully:', review._id);
      res.status(201).json({ message: 'Review added successfully', review });
      
    } catch (error) {
      console.error('Error creating review:', error);
      
      // Clean up uploaded file if review creation failed
      if (req.file) {
        safeDeleteImage(`uploads/review-images/${req.file.filename}`);
      }
      
      res.status(500).json({ error: 'Server error while creating review' });
    }
  }
);

// GET: All reviews (with usernames)
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'username')
      .sort({ createdAt: -1 }); // Sort by newest first
    
    console.log(`Fetched ${reviews.length} reviews`);
    res.json(reviews);
    
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Server error while fetching reviews' });
  }
});

// GET: Logged-in user's own reviews
router.get('/my', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const reviews = await Review.find({ user: userId })
      .sort({ createdAt: -1 }); // Sort by newest first
    
    console.log(`Fetched ${reviews.length} reviews for user ${userId}`);
    res.json(reviews);
    
  } catch (err) {
    console.error('Error fetching user reviews:', err);
    res.status(500).json({ error: 'Server error while fetching your reviews' });
  }
});

// PUT: Update review
router.put(
  '/:id',
  isLoggedIn,
  uploadReviewImage.single('animeImage'),
  handleMulterError,
  async (req, res) => {
    try {
      const reviewId = req.params.id;
      const userId = req.session.user._id;

      // Find and validate review
      const review = await Review.findById(reviewId);
      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }
      
      if (review.user.toString() !== userId) {
        return res.status(403).json({ error: 'You can only edit your own reviews' });
      }

      const { animeTitle, reviewText, rating } = req.body;

      // Validate fields
      if (!animeTitle || !reviewText || !rating) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      // Handle image update
      if (req.file) {
        // Delete old image if it exists
        if (review.animeImageUrl) {
          safeDeleteImage(review.animeImageUrl);
        }
        
        // Set new image path
review.animeImageUrl = `/uploads/review-images/${req.file.filename}`;      }

      // Update review fields
      review.animeTitle = animeTitle.trim();
      review.reviewText = reviewText.trim();
      review.rating = ratingNum;

      await review.save();
      
      console.log('Review updated successfully:', reviewId);
      res.json({ message: 'Review updated successfully', review });
      
    } catch (err) {
      console.error('Error updating review:', err);
      
      // Clean up uploaded file if update failed
      if (req.file) {
        safeDeleteImage(`uploads/review-images/${req.file.filename}`);
      }
      
      res.status(500).json({ error: 'Server error while updating review' });
    }
  }
);

// DELETE: Delete review
router.delete('/:id', isLoggedIn, async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.session.user._id;

    // Find and validate review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    if (review.user.toString() !== userId) {
      return res.status(403).json({ error: 'You can only delete your own reviews' });
    }

    // Delete associated image file
    if (review.animeImageUrl) {
      safeDeleteImage(review.animeImageUrl);
    }

    // Delete the review
    await review.deleteOne();
    
    console.log('Review deleted successfully:', reviewId);
    res.json({ message: 'Review deleted successfully' });
    
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: 'Server error while deleting review' });
  }
});

module.exports = router;