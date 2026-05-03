const mongoose = require('mongoose');

// Each item in the cart
const OrderItemSchema = new mongoose.Schema({
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  vendor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  name:         String,   // snapshot at purchase time
  image:        String,
  variationSku: String,   // null if no variation
  attributes:   { type: Map, of: String },
  quantity:     { type: Number, required: true, min: 1 },
  unitPrice:    { type: Number, required: true },
  totalPrice:   { type: Number, required: true },
});

// Per-vendor sub-order within a single customer order
const VendorSubOrderSchema = new mongoose.Schema({
  vendor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:    [OrderItemSchema],
  subtotal: Number,

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
  },

  trackingNumber: String,
  trackingUrl:    String,
  shippingPartner:String,

  // Timeline
  confirmedAt: Date,
  shippedAt:   Date,
  deliveredAt: Date,
  cancelledAt: Date,

  cancelReason: String,
  vendorNotes:  String,
});

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Snapshot of shipping address
    shippingAddress: {
      name:    String,
      phone:   String,
      line1:   String,
      line2:   String,
      city:    String,
      state:   String,
      pincode: String,
      country: { type: String, default: 'India' },
    },

    // Vendor sub-orders (one per vendor)
    subOrders: [VendorSubOrderSchema],

    // Aggregated financials
    itemsTotal:      { type: Number, required: true },
    shippingTotal:   { type: Number, default: 0 },
    taxTotal:        { type: Number, default: 0 },
    discountTotal:   { type: Number, default: 0 },
    grandTotal:      { type: Number, required: true },

    // Coupon
    couponCode:     String,
    couponDiscount: Number,

    // Payment
    paymentMethod: {
      type: String,
      enum: ['cashfree', 'cod'],
      default: 'cashfree',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
      default: 'pending',
    },

    // Cashfree specifics
    cashfreeOrderId:   String,
    cashfreePaymentId: String,
    cashfreeSignature: String,
    paidAt:            Date,

    // Overall order status (derived from subOrders)
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'partially_shipped',
             'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
    },

    // Stock deducted flag (set by webhook)
    stockDeducted: { type: Boolean, default: false },

    notes: String,
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ 'subOrders.vendor': 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ cashfreeOrderId: 1 });
OrderSchema.index({ paymentStatus: 1, status: 1 });

// ─── Pre-save: generate order number ─────────────────────────────────────────
OrderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    const ts   = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `ORD-${ts}-${rand}`;
  }
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
