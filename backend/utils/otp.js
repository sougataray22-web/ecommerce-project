const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');

// ─── Generate a 6-digit numeric OTP ──────────────────────────────────────────
const generateOTP = () =>
  otpGenerator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

// ─── Nodemailer transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Send OTP Email ───────────────────────────────────────────────────────────
const sendOtpEmail = async (to, otp, purpose = 'Login') => {
  const expireMin = process.env.OTP_EXPIRE_MINUTES || 10;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <style>
      body { font-family: 'Segoe UI', sans-serif; background:#f4f4f4; margin:0; padding:0; }
      .wrapper { max-width:520px; margin:40px auto; background:#fff; border-radius:12px;
                 overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
      .header  { background:linear-gradient(135deg,#1a1a2e,#16213e); padding:32px;
                 text-align:center; }
      .header h1 { color:#fff; margin:0; font-size:24px; letter-spacing:1px; }
      .body    { padding:36px; }
      .otp-box { background:#f8f9ff; border:2px dashed #4f46e5; border-radius:10px;
                 text-align:center; padding:24px; margin:24px 0; }
      .otp-code { font-size:40px; font-weight:800; letter-spacing:12px;
                  color:#4f46e5; font-family:monospace; }
      p { color:#555; line-height:1.7; }
      .expire { font-size:13px; color:#999; text-align:center; margin-top:8px; }
      .footer { background:#f8f9ff; padding:16px; text-align:center;
                font-size:12px; color:#aaa; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="header"><h1>${process.env.FROM_NAME || 'YourStore'}</h1></div>
      <div class="body">
        <p>Hi there 👋</p>
        <p>You requested a <strong>${purpose}</strong> OTP. Use the code below:</p>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <div class="expire">Expires in ${expireMin} minutes</div>
        </div>
        <p>If you didn't request this, please ignore this email. Your account remains safe.</p>
        <p>— The ${process.env.FROM_NAME || 'YourStore'} Team</p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} ${process.env.FROM_NAME || 'YourStore'}. All rights reserved.</div>
    </div>
  </body>
  </html>`;

  await transporter.sendMail({
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: `${otp} is your ${process.env.FROM_NAME || ''} OTP (${purpose})`,
    html,
  });
};

// ─── Send Vendor Approval Email ───────────────────────────────────────────────
const sendVendorApprovalEmail = async (to, name, approved, reason = '') => {
  const status = approved ? 'Approved ✅' : 'Rejected ❌';
  const color  = approved ? '#16a34a' : '#dc2626';
  const message = approved
    ? 'Congratulations! Your vendor account has been approved. You can now log in and start listing your products.'
    : `Unfortunately your KYC application was rejected. Reason: <strong>${reason}</strong>. Please resubmit with corrected documents.`;

  const html = `
  <!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:'Segoe UI',sans-serif;background:#f4f4f4;margin:0;padding:0}
    .w{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .h{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px;text-align:center}
    .h h1{color:#fff;margin:0;font-size:24px}
    .b{padding:36px}
    .badge{display:inline-block;padding:8px 20px;border-radius:999px;font-weight:700;color:#fff;background:${color};margin:16px 0}
    p{color:#555;line-height:1.7}
  </style></head>
  <body>
    <div class="w">
      <div class="h"><h1>${process.env.FROM_NAME || 'YourStore'}</h1></div>
      <div class="b">
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your KYC application status: <span class="badge">${status}</span></p>
        <p>${message}</p>
        <p>— The ${process.env.FROM_NAME || 'YourStore'} Admin Team</p>
      </div>
    </div>
  </body></html>`;

  await transporter.sendMail({
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: `KYC Application ${status} – ${process.env.FROM_NAME || ''}`,
    html,
  });
};

// ─── OTP expiry helper ────────────────────────────────────────────────────────
const otpExpiryDate = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + Number(process.env.OTP_EXPIRE_MINUTES || 10));
  return d;
};

module.exports = { generateOTP, sendOtpEmail, sendVendorApprovalEmail, otpExpiryDate };
