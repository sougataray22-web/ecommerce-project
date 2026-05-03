require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const connectDB  = require('./config/db');

const authRoutes    = require('./routes/auth');
const kycRoutes     = require('./routes/kyc');
const {
  productRouter, orderRouter, paymentRouter, bannerRouter, adminRouter,
} = require('./routes/index');

// ─── Connect Database ─────────────────────────────────────────────────────────
connectDB();

const app = express();

// ─── Raw body capture for Cashfree webhook signature verification ─────────────
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => { req.rawBody = data; next(); });
  } else {
    next();
  }
});

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { ok: false, message: 'Too many requests. Please try later.' },
}));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, service: 'ecommerce-api', ts: new Date() }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/kyc',      kycRoutes);
app.use('/api/products', productRouter);
app.use('/api/orders',   orderRouter);
app.use('/api/payment',  paymentRouter);
app.use('/api/banners',  bannerRouter);
app.use('/api/admin',    adminRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ ok: false, message: `Route ${req.originalUrl} not found.` }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ ok: false, message: err.message || 'Internal server error.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  console.log(`📧 Owner email: ${process.env.OWNER_EMAIL}`);
});

module.exports = app;
