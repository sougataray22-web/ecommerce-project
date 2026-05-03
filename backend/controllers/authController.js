const User           = require('../models/User');
const { generateOTP, sendOtpEmail, otpExpiryDate } = require('../utils/otp');
const { signToken }  = require('../utils/jwt');
const { success, error } = require('../utils/response');
const bcrypt         = require('bcryptjs');

// ─── Helper: determine & set role ─────────────────────────────────────────────
const resolveRole = (identifier) => {
  if (
    identifier === process.env.OWNER_EMAIL ||
    identifier === process.env.OWNER_PHONE
  )
    return 'owner';
  return null; // caller decides customer vs vendor
};

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────────
// Body: { identifier, type: 'email'|'phone', purpose: 'login'|'register' }
exports.sendOtp = async (req, res) => {
  try {
    const { identifier, type, purpose = 'login' } = req.body;
    if (!identifier || !type) return error(res, 'identifier and type are required.', 400);

    const otp    = generateOTP();
    const hashed = await bcrypt.hash(otp, 10);
    const expiry = otpExpiryDate();
    const isOwnerCred = User.isOwnerCredential(identifier);

    // Find or initialise user
    const query = type === 'email' ? { email: identifier } : { phone: identifier };
    let user = await User.findOne(query).select('+emailOtp +emailOtpExpire +phoneOtp +phoneOtpExpire');

    if (!user) {
      if (purpose === 'login') return error(res, 'No account found. Please register first.', 404);
      // Auto-create on first register
      const roleToSet = isOwnerCred ? 'owner' : 'customer';
      user = new User({ [type]: identifier, role: roleToSet });
    }

    // Override role if owner credential
    if (isOwnerCred) user.role = 'owner';

    if (type === 'email') {
      user.emailOtp       = hashed;
      user.emailOtpExpire = expiry;
    } else {
      user.phoneOtp       = hashed;
      user.phoneOtpExpire = expiry;
    }

    await user.save({ validateBeforeSave: false });

    // Deliver OTP
    if (type === 'email') {
      await sendOtpEmail(identifier, otp, purpose === 'register' ? 'Registration' : 'Login');
    }
    // For phone: integrate your SMS gateway here (Twilio / Fast2SMS / MSG91)
    // await sendSmsOtp(identifier, otp);

    success(res, {}, `OTP sent to ${type === 'email' ? identifier : 'your phone'}.`, 200);
  } catch (err) {
    console.error('sendOtp error:', err);
    error(res, err.message || 'Failed to send OTP.', 500);
  }
};

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
// Body: { identifier, type, otp, role? (customer|vendor on register) }
exports.verifyOtp = async (req, res) => {
  try {
    const { identifier, type, otp, role: requestedRole } = req.body;
    if (!identifier || !type || !otp) return error(res, 'identifier, type, and otp required.', 400);

    const query = type === 'email' ? { email: identifier } : { phone: identifier };
    const user  = await User.findOne(query).select(
      '+emailOtp +emailOtpExpire +phoneOtp +phoneOtpExpire'
    );

    if (!user) return error(res, 'User not found.', 404);

    const storedHash   = type === 'email' ? user.emailOtp       : user.phoneOtp;
    const storedExpiry = type === 'email' ? user.emailOtpExpire : user.phoneOtpExpire;

    if (!storedHash || !storedExpiry) return error(res, 'No OTP found. Please request again.', 400);
    if (new Date() > storedExpiry)    return error(res, 'OTP expired. Please request again.', 400);

    const isMatch = await bcrypt.compare(otp, storedHash);
    if (!isMatch) return error(res, 'Invalid OTP.', 400);

    // Mark verified
    if (type === 'email') {
      user.isEmailVerified = true;
      user.emailOtp        = undefined;
      user.emailOtpExpire  = undefined;
    } else {
      user.isPhoneVerified = true;
      user.phoneOtp        = undefined;
      user.phoneOtpExpire  = undefined;
    }

    // Assign role if new user picking vendor
    if (!user.role || user.role === 'customer') {
      if (requestedRole === 'vendor') user.role = 'vendor';
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // ── Role-based redirect logic ─────────────────────────────────────────────
    let redirectPath = '/';
    if (user.role === 'owner') {
      redirectPath = '/admin/dashboard';
    } else if (user.role === 'vendor') {
      redirectPath = user.isApproved
        ? '/vendor/dashboard'
        : user.kycSubmitted
        ? '/vendor/kyc-pending'
        : '/vendor/kyc';
    } else {
      redirectPath = '/';
    }

    const token = signToken({ id: user._id, role: user.role });

    success(res, {
      token,
      user: {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        phone:        user.phone,
        role:         user.role,
        isApproved:   user.isApproved,
        kycSubmitted: user.kycSubmitted,
        avatar:       user.avatar,
      },
      redirectPath,
    }, 'Login successful.');
  } catch (err) {
    console.error('verifyOtp error:', err);
    error(res, err.message || 'Verification failed.', 500);
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist', 'name images effectivePrice slug');
    success(res, { user });
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── PATCH /api/auth/profile ──────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'businessName', 'avatar'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    success(res, { user }, 'Profile updated.');
  } catch (err) {
    error(res, err.message, 500);
  }
};

// ─── POST /api/auth/address ───────────────────────────────────────────────────
exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }
    user.addresses.push(req.body);
    await user.save();
    success(res, { addresses: user.addresses }, 'Address added.');
  } catch (err) {
    error(res, err.message, 500);
  }
};
