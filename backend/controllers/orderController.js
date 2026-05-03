const Order   = require('../models/Order');
const Product = require('../models/Product');
const User    = require('../models/User');
const { success, error } = require('../utils/response');

// ─── Helper: deduct stock ─────────────────────────────────────────────────────
const deductStock = async (subOrders) => {
  for (const sub of subOrders) {
    for (const item of sub.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      if (item.variationSku) {
        const variation = product.variations.find((v) => v.sku === item.variationSku);
        if (variation) {
          variation.stock = Math.max(0, variation.stock - item.quantity);
        }
      } else {
        product.baseStock = Math.max(0, product.baseStock - item.quantity);
      }
      await product.save();
    }
  }
};

// ─── POST /api/orders/create ──────────────────────────────────────────────────
// Body: { items: [{productId, variationSku?, quantity}], shippingAddress, couponCode? }
exports.createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, couponCode } = req.body;
    if (!items?.length)        return error(res, 'Cart is empty.', 400);
    if (!shippingAddress)      return error(res, 'Shipping address is required.', 400);

    // ── Build order items + group by vendor ───────────────────────────────────
    const vendorMap = new Map();  // vendorId → [item]

    for (const { productId, variationSku, quantity } of items) {
      const product = await Product.findById(productId).populate('vendor', '_id name');
      if (!product || !product.isActive) return error(res, `Product ${productId} not available.`, 400);

      let unitPrice;
      let availableStock;
      let itemImage = product.images[0];

      if (variationSku) {
        const v = product.variations.find((v) => v.sku === variationSku);
        if (!v) return error(res, `Variation ${variationSku} not found.`, 400);
        if (v.stock < quantity) return error(res, `Insufficient stock for ${product.name} (${variationSku}).`, 400);
        unitPrice      = v.price;
        availableStock = v.stock;
        if (v.images?.length) itemImage = v.images[0];
      } else {
        if (product.baseStock < quantity) return error(res, `Insufficient stock for ${product.name}.`, 400);
        unitPrice      = product.basePrice;
        availableStock = product.baseStock;
      }

      const vendorId = String(product.vendor._id);
      if (!vendorMap.has(vendorId)) vendorMap.set(vendorId, []);
      vendorMap.get(vendorId).push({
        product:      product._id,
        vendor:       product.vendor._id,
        name:         product.name,
        image:        itemImage,
        variationSku: variationSku || undefined,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      });
    }

    // ── Build subOrders array ─────────────────────────────────────────────────
    const subOrders = [];
    let itemsTotal  = 0;

    for (const [vendorId, orderItems] of vendorMap) {
      const subtotal = orderItems.reduce((s, i) => s + i.totalPrice, 0);
      itemsTotal += subtotal;
      subOrders.push({ vendor: vendorId, items: orderItems, subtotal });
    }

    // ── Shipping & tax ────────────────────────────────────────────────────────
    const shippingTotal = itemsTotal > 499 ? 0 : 49;
    const taxTotal      = Math.round(itemsTotal * 0.18);  // 18% GST example
    const discountTotal = couponCode ? 0 : 0;             // apply coupon logic here
    const grandTotal    = itemsTotal + shippingTotal + taxTotal - discountTotal;

    const order = await Order.create({
      customer:       req.user._id,
      shippingAddress,
      subOrders,
      itemsTotal,
      shippingTotal,
      taxTotal,
      discountTotal,
      grandTotal,
      couponCode,
      paymentMethod: 'cashfree',
    });

    success(res, { order }, 'Order created. Proceed to payment.', 201);
  } catch (err) {
    console.error('createOrder error:', err);
    error(res, err.message, 500);
  }
};

// ─── GET /api/orders  (customer: own, vendor: their sub-orders) ───────────────
exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    let query;
    let projection;

    if (req.user.role === 'customer') {
      query = { customer: req.user._id };
      if (status) query.status = status;
    } else if (req.user.role === 'vendor') {
      query = { 'subOrders.vendor': req.user._id };
      if (status) query['subOrders.status'] = status;
    } else {
      // owner sees all
      query = {};
      if (status) query.status = status;
    }

    const total  = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('customer', 'name email phone')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    success(res, { orders, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── GET /api/orders/:id ─────────────────────────────────────────────────────
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('subOrders.vendor', 'name businessName email');

    if (!order) return error(res, 'Order not found.', 404);

    // Access control
    if (
      req.user.role === 'customer' &&
      String(order.customer._id) !== String(req.user._id)
    ) return error(res, 'Not authorized.', 403);

    if (
      req.user.role === 'vendor' &&
      !order.subOrders.some((s) => String(s.vendor._id) === String(req.user._id))
    ) return error(res, 'Not authorized.', 403);

    success(res, { order });
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── PATCH /api/vendor/orders/:orderId/sub/:subOrderId  (vendor fulfillment) ──
exports.updateSubOrderStatus = async (req, res) => {
  try {
    const { orderId, subOrderId } = req.params;
    const { status, trackingNumber, trackingUrl, shippingPartner, vendorNotes } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return error(res, 'Order not found.', 404);

    const sub = order.subOrders.id(subOrderId);
    if (!sub) return error(res, 'Sub-order not found.', 404);
    if (String(sub.vendor) !== String(req.user._id) && req.user.role !== 'owner')
      return error(res, 'Not authorized.', 403);

    const validTransitions = {
      pending:    ['confirmed', 'cancelled'],
      confirmed:  ['processing', 'cancelled'],
      processing: ['shipped'],
      shipped:    ['delivered'],
    };

    if (validTransitions[sub.status] && !validTransitions[sub.status].includes(status))
      return error(res, `Cannot transition from ${sub.status} to ${status}.`, 400);

    sub.status          = status;
    if (trackingNumber)  sub.trackingNumber  = trackingNumber;
    if (trackingUrl)     sub.trackingUrl     = trackingUrl;
    if (shippingPartner) sub.shippingPartner = shippingPartner;
    if (vendorNotes)     sub.vendorNotes     = vendorNotes;

    const now = new Date();
    if (status === 'confirmed')  sub.confirmedAt = now;
    if (status === 'shipped')    sub.shippedAt   = now;
    if (status === 'delivered')  sub.deliveredAt = now;
    if (status === 'cancelled')  sub.cancelledAt = now;

    // Update parent order status
    const statuses = order.subOrders.map((s) => s.status);
    if (statuses.every((s) => s === 'delivered'))  order.status = 'delivered';
    else if (statuses.every((s) => s === 'cancelled')) order.status = 'cancelled';
    else if (statuses.some((s) => s === 'shipped'))    order.status = 'partially_shipped';
    else if (statuses.some((s) => s === 'processing')) order.status = 'processing';
    else if (statuses.some((s) => s === 'confirmed'))  order.status = 'confirmed';

    await order.save();
    success(res, { order }, 'Sub-order updated.');
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── Vendor Analytics ─────────────────────────────────────────────────────────
exports.getVendorAnalytics = async (req, res) => {
  try {
    const vendorId = req.user._id;

    // Total revenue
    const revenueAgg = await Order.aggregate([
      { $match: { 'subOrders.vendor': vendorId, paymentStatus: 'paid' } },
      { $unwind: '$subOrders' },
      { $match: { 'subOrders.vendor': vendorId } },
      { $group: { _id: null, total: { $sum: '$subOrders.subtotal' }, count: { $sum: 1 } } },
    ]);

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Order.aggregate([
      { $match: { 'subOrders.vendor': vendorId, paymentStatus: 'paid', createdAt: { $gte: sixMonthsAgo } } },
      { $unwind: '$subOrders' },
      { $match: { 'subOrders.vendor': vendorId } },
      {
        $group: {
          _id:     { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$subOrders.subtotal' },
          orders:  { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const analytics = {
      totalRevenue: revenueAgg[0]?.total || 0,
      totalOrders:  revenueAgg[0]?.count || 0,
      monthlyRevenue,
    };

    success(res, { analytics });
  } catch (err) {
    error(res, err.message, 500);
  }
};
