const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// ✅ Cloudinary config - automatically reads CLOUDINARY_URL from environment
cloudinary.config(); // This automatically reads process.env.CLOUDINARY_URL

// ✅ Image filter: allow only image files
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(file.originalname.toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) cb(null, true);
  else cb(new Error("Only image files are allowed!"));
};

// ✅ Storage: Profile Pictures
const profilePicStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "animehub/profile-pics",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 300, crop: "thumb", gravity: "face" }],
  },
});

// ✅ Storage: Review Images
const reviewImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "animehub/review-images",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, crop: "limit" }],
  },
});

// ✅ Storage: General Images (for chat/message images)
const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "animehub/general",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: [{ width: 1000, crop: "limit" }],
  },
});

// ✅ Uploaders using multer
const uploadProfilePic = multer({
  storage: profilePicStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: imageFilter,
});

const uploadReviewImage = multer({
  storage: reviewImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// ✅ UPDATED: Named 'uploadGeneral' to match message routes usage
const uploadGeneral = multer({
  storage: generalStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for general images
  fileFilter: imageFilter,
});

// ✅ Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({ error: "File too large" });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({ error: "Too many files" });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({ error: "Unexpected file field" });
      default:
        return res.status(400).json({ error: "File upload error" });
    }
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// ✅ Delete file from Cloudinary
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('File deleted from Cloudinary:', result);
    return result;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

// ✅ Get optimized image URL
const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    fetch_format: "auto",
    quality: "auto",
    ...options
  });
};

// ✅ Export for use in routes - UPDATED to match route imports
module.exports = {
  uploadProfilePic,
  uploadReviewImage,
  uploadGeneral, // ✅ Changed from uploadMessageImage to uploadGeneral
  handleMulterError,
  deleteFile,
  getOptimizedUrl,
  imageFilter,
  cloudinary
};