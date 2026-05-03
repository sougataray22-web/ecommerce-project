const mongoose = require('mongoose');

const VendorKYCSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Aadhar details
    aadharNumber: { type: String, required: true },
    aadharFront:  { type: String, required: true }, // Cloudinary URL
    aadharBack:   { type: String },                 // Cloudinary URL

    // Live selfie (captured via webcam)
    livePhoto: { type: String, required: true },    // Cloudinary URL (base64→upload)

    // Bank details
    bankAccountNumber: { type: String, required: true },
    bankIfscCode:      { type: String, required: true },
    bankAccountName:   { type: String, required: true },
    bankName:          { type: String },

    // Verification status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String },

    // Owner who reviewed
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:  { type: Date },

    // Business info
    businessName:    { type: String, required: true },
    businessAddress: { type: String, required: true },
    gstNumber:       { type: String },
    panNumber:       { type: String },

    // Re-submission count
    submissionCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

VendorKYCSchema.index({ vendor: 1 });
VendorKYCSchema.index({ status: 1 });

module.exports = mongoose.model('VendorKYC', VendorKYCSchema);
