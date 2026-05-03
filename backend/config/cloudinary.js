const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Storage Factories ────────────────────────────────────────────────────────

const makeStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'webp']) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: allowedFormats,
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });

// Product images  – up to 8 files
const productStorage = makeStorage('ecommerce/products');
// KYC Aadhar docs – PDF or image
const kycDocStorage  = makeStorage('ecommerce/kyc/documents', ['jpg', 'jpeg', 'png', 'pdf']);
// KYC live photo   – image only
const kycPhotoStorage = makeStorage('ecommerce/kyc/photos');
// Hero banners     – image only
const bannerStorage  = makeStorage('ecommerce/banners');
// Category icons
const categoryStorage = makeStorage('ecommerce/categories');

// ─── Multer Instances ─────────────────────────────────────────────────────────

const uploadProduct  = multer({ storage: productStorage,  limits: { fileSize: 5 * 1024 * 1024 } });
const uploadKycDoc   = multer({ storage: kycDocStorage,   limits: { fileSize: 10 * 1024 * 1024 } });
const uploadKycPhoto = multer({ storage: kycPhotoStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadBanner   = multer({ storage: bannerStorage,   limits: { fileSize: 10 * 1024 * 1024 } });
const uploadCategory = multer({ storage: categoryStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// ─── Delete Helper ────────────────────────────────────────────────────────────

const deleteFromCloudinary = async (publicIdOrUrl) => {
  try {
    // Accept full URL or raw public_id
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.startsWith('http')) {
      // Extract public_id from URL: everything after /upload/vXXXXX/
      const parts = publicIdOrUrl.split('/upload/');
      if (parts[1]) {
        publicId = parts[1].replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '');
      }
    }
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

module.exports = {
  cloudinary,
  uploadProduct,
  uploadKycDoc,
  uploadKycPhoto,
  uploadBanner,
  uploadCategory,
  deleteFromCloudinary,
};
