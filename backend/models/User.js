const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name:  { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    phone: { type: String, trim: true, sparse: true },

    // Role: 'owner' | 'vendor' | 'customer'
    role: { type: String, enum: ['owner', 'vendor', 'customer'], default: 'customer' },

    // Vendor-specific
    isApproved:  { type: Boolean, default: false },   // Owner approves vendors
    businessName: { type: String, trim: true },
    kycSubmitted: { type: Boolean, default: false },

    // Auth
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    // OTP fields (not returned by default)
    emailOtp:       { type: String, select: false },
    emailOtpExpire: { type: Date,   select: false },
    phoneOtp:       { type: String, select: false },
    phoneOtpExpire: { type: Date,   select: false },

    // Customer
    addresses: [
      {
        label:    { type: String },      // Home / Office
        line1:    String,
        line2:    String,
        city:     String,
        state:    String,
        pincode:  String,
        country:  { type: String, default: 'India' },
        isDefault:{ type: Boolean, default: false },
      },
    ],

    // Wishlist (product refs)
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    // Profile photo
    avatar: { type: String },

    isActive:   { type: Boolean, default: true },
    lastLoginAt:{ type: Date },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1 });

// ─── Statics ──────────────────────────────────────────────────────────────────

// Detect and return the owner from env
UserSchema.statics.isOwnerCredential = function (emailOrPhone) {
  return (
    emailOrPhone === process.env.OWNER_EMAIL ||
    emailOrPhone === process.env.OWNER_PHONE
  );
};

module.exports = mongoose.model('User', UserSchema);
