const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Utility: Ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
};

// ✅ Image filter
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

// ✅ Document filter (optional)
const documentFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /application\/pdf|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document|text\/plain/.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only document files (PDF, DOC, DOCX, TXT) are allowed!"));
  }
};

// ✅ Profile Picture Storage - FIXED to match SERVER/public directory
const profilePicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'profile-pics');
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const userId = req?.session?.user?._id || 'guest';
    const uniqueName = `${userId}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// ✅ General File Upload Storage - FIXED to match SERVER/public directory
const generalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'general');
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

// ✅ Anime Review Image Storage - FIXED to match SERVER/public directory
const reviewImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'review-images');
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = `review_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});;

// ✅ Multer Configurations

const uploadProfilePic = multer({
  storage: profilePicStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: imageFilter
});

const uploadGeneral = multer({
  storage: generalStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

const uploadDocument = multer({
  storage: generalStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 3
  },
  fileFilter: documentFilter
});

const uploadReviewImage = multer({
  storage: reviewImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: imageFilter
});

// ✅ File Deletion Utility
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

// ✅ Multer Error Handling Middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ error: 'File too large' });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ error: 'Too many files' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ error: 'Unexpected file field' });
      default:
        return res.status(400).json({ error: 'File upload error' });
    }
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// ✅ Export all
module.exports = {
  uploadProfilePic,
  uploadGeneral,
  uploadDocument,
  uploadReviewImage,
  deleteFile,
  ensureDirectoryExists,
  handleMulterError,
  imageFilter,
  documentFilter
};