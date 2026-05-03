const { verifyToken } = require('../utils/jwt');
const { error }       = require('../utils/response');
const User            = require('../models/User');

// ─── Authenticate JWT ──────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;
    const { authorization } = req.headers;
    if (authorization && authorization.startsWith('Bearer ')) {
      token = authorization.split(' ')[1];
    }

    if (!token) return error(res, 'Not authenticated. Please login.', 401);

    const decoded = verifyToken(token);
    const user    = await User.findById(decoded.id).select('-emailOtp -phoneOtp -emailOtpExpire -phoneOtpExpire');

    if (!user)       return error(res, 'User no longer exists.', 401);
    if (!user.isActive) return error(res, 'Your account has been deactivated.', 403);

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return error(res, 'Session expired. Please login again.', 401);
    return error(res, 'Invalid token.', 401);
  }
};

// ─── Role Guards ───────────────────────────────────────────────────────────────
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return error(res, `Access denied. Requires role: ${roles.join(' or ')}.`, 403);
  }
  next();
};

const ownerOnly   = authorizeRoles('owner');
const vendorOnly  = authorizeRoles('vendor', 'owner');   // owner can view vendor routes
const staffOnly   = authorizeRoles('owner', 'vendor');

// ─── Vendor approval check ────────────────────────────────────────────────────
const approvedVendorOnly = (req, res, next) => {
  if (req.user.role === 'owner') return next();  // owner bypasses
  if (req.user.role !== 'vendor') return error(res, 'Vendors only.', 403);
  if (!req.user.isApproved) return error(res, 'Your vendor account is pending approval.', 403);
  next();
};

// ─── Ownership check for resources ───────────────────────────────────────────
const isOwnerOrAdmin = (resourceUserId) => (req, res, next) => {
  if (req.user.role === 'owner') return next();
  if (String(req.user._id) === String(resourceUserId)) return next();
  return error(res, 'You are not authorized to perform this action.', 403);
};

module.exports = { protect, ownerOnly, vendorOnly, approvedVendorOnly, isOwnerOrAdmin, authorizeRoles };
