const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/kycController');
const { protect, vendorOnly, ownerOnly } = require('../middleware/auth');
const { uploadKycDoc, uploadKycPhoto }   = require('../config/cloudinary');
const multer  = require('multer');

// Combine multiple upload fields
const kycUpload = multer({
  storage: require('multer-storage-cloudinary').CloudinaryStorage
    ? undefined : undefined,
}).fields([]);

// Use separate cloudinary storages per field type
// We'll handle via a custom middleware that applies the right storage
const cloudinaryV2 = require('../config/cloudinary');

// For KYC we need multiple file types in one request, so we use uploadKycDoc for docs
// and chain them; simplest approach: use uploadKycDoc for all KYC files
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary').cloudinary;
const multerInst = require('multer');

const kycStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPhoto = file.fieldname === 'livePhoto';
    return {
      folder: isPhoto ? 'ecommerce/kyc/photos' : 'ecommerce/kyc/documents',
      allowed_formats: isPhoto ? ['jpg', 'jpeg', 'png', 'webp'] : ['jpg', 'jpeg', 'png', 'pdf'],
      transformation: [{ quality: 'auto' }],
    };
  },
});

const kycMulter = multerInst({
  storage: kycStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'aadharFront', maxCount: 1 },
  { name: 'aadharBack',  maxCount: 1 },
  { name: 'livePhoto',   maxCount: 1 },
]);

// Vendor routes
router.post('/submit',  protect, vendorOnly, kycMulter, ctrl.submitKYC);
router.get('/my-kyc',   protect, vendorOnly, ctrl.getMyKYC);

// Admin routes
router.get('/all',             protect, ownerOnly, ctrl.getAllKYC);
router.patch('/:id/review',    protect, ownerOnly, ctrl.reviewKYC);

module.exports = router;
