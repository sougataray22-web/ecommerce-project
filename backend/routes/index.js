// ═══════════════════════════════════════════════════════════
// routes/products.js
// ═══════════════════════════════════════════════════════════
const express  = require('express');
const pRouter  = express.Router();
const pCtrl    = require('../controllers/productController');
const { protect, approvedVendorOnly, ownerOnly } = require('../middleware/auth');
const { uploadProduct } = require('../config/cloudinary');

// Public
pRouter.get('/',        pCtrl.getProducts);
pRouter.get('/:slug',   pCtrl.getProduct);

// Vendor
pRouter.get ('/vendor/mine',         protect, approvedVendorOnly, pCtrl.getVendorProducts);
pRouter.post('/vendor',              protect, approvedVendorOnly, uploadProduct.array('images', 8), pCtrl.createProduct);
pRouter.patch('/vendor/:id',         protect, approvedVendorOnly, uploadProduct.array('images', 8), pCtrl.updateProduct);
pRouter.delete('/vendor/:id',        protect, approvedVendorOnly, pCtrl.deleteProduct);
pRouter.delete('/vendor/:id/image',  protect, approvedVendorOnly, pCtrl.deleteProductImage);

// Admin can also delete any product
pRouter.delete('/admin/:id',         protect, ownerOnly, pCtrl.deleteProduct);

module.exports = { productRouter: pRouter };


// ═══════════════════════════════════════════════════════════
// routes/orders.js
// ═══════════════════════════════════════════════════════════
const oRouter = express.Router();
const oCtrl   = require('../controllers/orderController');

oRouter.post  ('/',                                          protect, oCtrl.createOrder);
oRouter.get   ('/',                                          protect, oCtrl.getOrders);
oRouter.get   ('/:id',                                       protect, oCtrl.getOrder);
oRouter.patch ('/:orderId/sub/:subOrderId',                  protect, approvedVendorOnly, oCtrl.updateSubOrderStatus);
oRouter.get   ('/vendor/analytics',                         protect, approvedVendorOnly, oCtrl.getVendorAnalytics);

module.exports.orderRouter = oRouter;


// ═══════════════════════════════════════════════════════════
// routes/payment.js
// ═══════════════════════════════════════════════════════════
const payRouter = express.Router();
const payCtrl   = require('../controllers/paymentController');

payRouter.post('/create-session',   protect, payCtrl.createPaymentSession);
payRouter.get ('/verify/:orderId',  protect, payCtrl.verifyPayment);
payRouter.post('/webhook',                   payCtrl.webhook);   // No auth – verified by signature

module.exports.paymentRouter = payRouter;


// ═══════════════════════════════════════════════════════════
// routes/banners.js
// ═══════════════════════════════════════════════════════════
const bRouter = express.Router();
const bCtrl   = require('../controllers/bannerController');
const { uploadBanner } = require('../config/cloudinary');

bRouter.get  ('/',               bCtrl.getBanners);                               // public
bRouter.get  ('/admin',          protect, ownerOnly, bCtrl.getAllBanners);
bRouter.post ('/',               protect, ownerOnly, uploadBanner.single('image'), bCtrl.createBanner);
bRouter.patch('/reorder',        protect, ownerOnly, bCtrl.reorderBanners);
bRouter.patch('/:id',            protect, ownerOnly, uploadBanner.single('image'), bCtrl.updateBanner);
bRouter.delete('/:id',           protect, ownerOnly, bCtrl.deleteBanner);

module.exports.bannerRouter = bRouter;


// ═══════════════════════════════════════════════════════════
// routes/admin.js  – Owner master panel APIs
// ═══════════════════════════════════════════════════════════
const aRouter = express.Router();
const User    = require('../models/User');
const Product = require('../models/Product');
const Order   = require('../models/Order');
const { success, error } = require('../utils/response');

// All admin routes require owner role
aRouter.use(protect, ownerOnly);

// Dashboard stats
aRouter.get('/stats', async (req, res) => {
  try {
    const [users, vendors, products, orders, revenueAgg] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'vendor' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } },
      ]),
    ]);
    success(res, {
      stats: {
        customers: users,
        vendors,
        products,
        orders,
        totalRevenue: revenueAgg[0]?.total || 0,
      },
    });
  } catch (err) {
    error(res, err.message, 500);
  }
});

// List vendors
aRouter.get('/vendors', async (req, res) => {
  try {
    const { page = 1, limit = 20, isApproved } = req.query;
    const filter = { role: 'vendor' };
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    const total   = await User.countDocuments(filter);
    const vendors = await User.find(filter).sort('-createdAt').skip((page-1)*limit).limit(Number(limit));
    success(res, { vendors, total });
  } catch (err) {
    error(res, err.message, 500);
  }
});

// Toggle vendor active/deactive
aRouter.patch('/vendors/:id/toggle', async (req, res) => {
  try {
    const vendor = await User.findById(req.params.id);
    if (!vendor || vendor.role !== 'vendor') return error(res, 'Vendor not found.', 404);
    vendor.isActive = !vendor.isActive;
    await vendor.save();
    success(res, { vendor }, `Vendor ${vendor.isActive ? 'activated' : 'deactivated'}.`);
  } catch (err) {
    error(res, err.message, 500);
  }
});

// List all orders
aRouter.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus } = req.query;
    const filter = {};
    if (status)        filter.status        = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    const total  = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('customer', 'name email phone')
      .sort('-createdAt')
      .skip((page-1)*limit)
      .limit(Number(limit));
    success(res, { orders, total });
  } catch (err) {
    error(res, err.message, 500);
  }
});

module.exports.adminRouter = aRouter;
