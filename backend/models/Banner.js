const mongoose = require('mongoose');

// ─── Hero Banner ──────────────────────────────────────────────────────────────
const BannerSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    subtitle:    { type: String },
    imageUrl:    { type: String, required: true },   // Cloudinary URL
    publicId:    { type: String },                   // For deletion

    // Where clicking the banner leads
    targetType: {
      type: String,
      enum: ['product', 'category', 'url', 'none'],
      default: 'none',
    },
    targetId:   { type: String },   // Product ID or Category ID
    targetUrl:  { type: String },   // External / custom URL

    position:  { type: Number, default: 0 },    // Sort order
    isActive:  { type: Boolean, default: true },
    startDate: { type: Date },
    endDate:   { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

BannerSchema.index({ isActive: 1, position: 1 });

// ─── Category ─────────────────────────────────────────────────────────────────
const CategorySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, unique: true, lowercase: true },
    description: { type: String },
    image:       { type: String },    // Cloudinary URL
    publicId:    { type: String },

    parent:   { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    level:    { type: Number, default: 0 },       // 0 = root, 1 = sub, 2 = sub-sub
    position: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    metaTitle:       String,
    metaDescription: String,
  },
  { timestamps: true }
);

CategorySchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

CategorySchema.index({ parent: 1, isActive: 1 });
CategorySchema.index({ slug: 1 });

// ─── Review ───────────────────────────────────────────────────────────────────
const ReviewSchema = new mongoose.Schema(
  {
    product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    order:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    rating:   { type: Number, required: true, min: 1, max: 5 },
    title:    { type: String, trim: true },
    body:     { type: String },
    images:   [String],
    isVerifiedPurchase: { type: Boolean, default: false },
    isApproved:         { type: Boolean, default: true },
  },
  { timestamps: true }
);

ReviewSchema.index({ product: 1, isApproved: 1 });
ReviewSchema.index({ customer: 1 });

module.exports = {
  Banner:   mongoose.model('Banner',   BannerSchema),
  Category: mongoose.model('Category', CategorySchema),
  Review:   mongoose.model('Review',   ReviewSchema),
};
