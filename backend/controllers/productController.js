const Product    = require('../models/Product');
const { Category } = require('../models/Banner');
const { deleteFromCloudinary } = require('../config/cloudinary');
const { success, error } = require('../utils/response');

// ─── GET /api/products  (public) ─────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, category, vendor, search,
      minPrice, maxPrice, sort = '-createdAt', featured,
    } = req.query;

    const filter = { isActive: true };
    if (category)  filter.category  = category;
    if (vendor)    filter.vendor    = vendor;
    if (featured)  filter.isFeatured = featured === 'true';
    if (search)    filter.$text     = { $search: search };
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice) filter.basePrice.$gte = Number(minPrice);
      if (maxPrice) filter.basePrice.$lte = Number(maxPrice);
    }

    const total    = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('vendor', 'name businessName avatar')
      .populate('category', 'name slug')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean({ virtuals: true });

    success(res, { products, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── GET /api/products/:slug  (public) ────────────────────────────────────────
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true })
      .populate('vendor', 'name businessName avatar')
      .populate('category', 'name slug')
      .lean({ virtuals: true });
    if (!product) return error(res, 'Product not found.', 404);
    success(res, { product });
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── POST /api/vendor/products  (vendor) ──────────────────────────────────────
exports.createProduct = async (req, res) => {
  try {
    const imageUrls = req.files?.map((f) => f.path) || [];
    if (imageUrls.length === 0) return error(res, 'At least one product image is required.', 400);

    const {
      name, description, brand, category, subCategory, tags,
      basePrice, baseMrp, baseStock,
      variationAxes, variations,
      weight, freeShipping, shippingCharges,
      metaTitle, metaDescription,
    } = req.body;

    const parsedVariations = variations ? JSON.parse(variations) : [];
    const parsedAxes       = variationAxes ? JSON.parse(variationAxes) : [];
    const parsedTags       = tags ? JSON.parse(tags) : [];

    const product = await Product.create({
      vendor: req.user._id,
      name, description, brand,
      category, subCategory,
      tags: parsedTags,
      images: imageUrls,
      basePrice: Number(basePrice) || 0,
      baseMrp:   Number(baseMrp)   || 0,
      baseStock: Number(baseStock) || 0,
      variationAxes: parsedAxes,
      variations: parsedVariations,
      weight: weight ? Number(weight) : undefined,
      freeShipping: freeShipping === 'true',
      shippingCharges: Number(shippingCharges) || 0,
      metaTitle, metaDescription,
    });

    success(res, { product }, 'Product created.', 201);
  } catch (err) {
    console.error('createProduct error:', err);
    error(res, err.message, 500);
  }
};

// ─── PATCH /api/vendor/products/:id  (vendor owner or admin) ─────────────────
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return error(res, 'Product not found.', 404);

    // Only owner vendor or admin can update
    if (req.user.role !== 'owner' && String(product.vendor) !== String(req.user._id))
      return error(res, 'Not authorized.', 403);

    const updates = { ...req.body };

    // Handle new images
    if (req.files?.length) {
      updates.images = [...(product.images || []), ...req.files.map((f) => f.path)];
    }

    if (updates.variations)    updates.variations    = JSON.parse(updates.variations);
    if (updates.variationAxes) updates.variationAxes = JSON.parse(updates.variationAxes);
    if (updates.tags)          updates.tags          = JSON.parse(updates.tags);

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    success(res, { product: updated }, 'Product updated.');
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── DELETE /api/vendor/products/:id ─────────────────────────────────────────
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return error(res, 'Product not found.', 404);
    if (req.user.role !== 'owner' && String(product.vendor) !== String(req.user._id))
      return error(res, 'Not authorized.', 403);

    // Delete Cloudinary images
    await Promise.allSettled(product.images.map((url) => deleteFromCloudinary(url)));

    await product.deleteOne();
    success(res, {}, 'Product deleted.');
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── DELETE image from product ────────────────────────────────────────────────
exports.deleteProductImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;

    const product = await Product.findById(id);
    if (!product) return error(res, 'Product not found.', 404);
    if (req.user.role !== 'owner' && String(product.vendor) !== String(req.user._id))
      return error(res, 'Not authorized.', 403);
    if (product.images.length <= 1) return error(res, 'Product must have at least one image.', 400);

    await deleteFromCloudinary(imageUrl);
    product.images = product.images.filter((img) => img !== imageUrl);
    await product.save();
    success(res, { images: product.images }, 'Image deleted.');
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── GET /api/vendor/products  (vendor's own products) ───────────────────────
exports.getVendorProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = { vendor: req.user._id };
    if (search) filter.$text = { $search: search };

    const total    = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('category', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean({ virtuals: true });

    success(res, { products, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    error(res, err.message, 500);
  }
};
