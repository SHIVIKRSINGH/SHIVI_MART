const express = require("express");
const router = express.Router();
const db = require("../config/database");
const jwt = require("jsonwebtoken");

// Helper function to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to send OTP via WhatsApp using MSG91
async function sendWhatsAppOTP(mobile, otp) {
  try {
    const axios = require("axios");

    // Format mobile number
    let formattedMobile = mobile.replace(/[\s\-\(\)\+]/g, "");
    if (!formattedMobile.startsWith("91")) {
      formattedMobile = "91" + formattedMobile;
    }

    const payload = {
      integrated_number: process.env.MSG91_WHATSAPP_NUMBER || "919818932110",
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "otp_verification",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace:
            process.env.MSG91_TEMPLATE_NAMESPACE ||
            "c9e6fe86_735b_464c_9e10_e7b3cb30db45",
          to_and_components: [
            {
              to: [formattedMobile],
              components: {
                body_1: {
                  type: "text",
                  value: otp,
                },
              },
            },
          ],
        },
      },
    };

    console.log("📱 Sending WhatsApp OTP to:", formattedMobile);

    const response = await axios.post(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          authkey: process.env.MSG91_AUTH_KEY || "509731AB7GUd9k69e34ffaP1",
        },
      },
    );

    console.log("✅ WhatsApp OTP sent successfully");
    return {
      success: true,
      message: "OTP sent successfully",
      data: response.data,
    };
  } catch (error) {
    console.error(
      "❌ WhatsApp OTP error:",
      error.response?.data || error.message,
    );

    // Fallback - log OTP in development
    if (process.env.NODE_ENV === "development") {
      console.log(`📱 DEV MODE - OTP for ${mobile}: ${otp}`);
    }

    return {
      success: false,
      message: "Failed to send WhatsApp OTP",
      error: error.message,
    };
  }
}

// POST /api/auth/send-otp
// Send OTP to mobile number
router.post("/send-otp", async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || mobile.length !== 10) {
      return res
        .status(400)
        .json({ error: "Valid 10-digit mobile number required" });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Check if user exists
    const [users] = await db.query("SELECT id FROM users WHERE mobile = ?", [
      mobile,
    ]);

    if (users.length > 0) {
      // Update existing user
      await db.query(
        "UPDATE users SET otp = ?, otp_expiry = ? WHERE mobile = ?",
        [otp, otpExpiry, mobile],
      );
    } else {
      // Create new user
      await db.query(
        "INSERT INTO users (mobile, otp, otp_expiry) VALUES (?, ?, ?)",
        [mobile, otp, otpExpiry],
      );
    }

    // Send OTP via WhatsApp
    await sendWhatsAppOTP(mobile, otp);

    res.json({
      success: true,
      message: "OTP sent successfully",
      // Remove this in production! Only for development
      dev_otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// POST /api/auth/verify-otp
// Verify OTP and login
router.post("/verify-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ error: "Mobile and OTP required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE mobile = ? AND otp = ? AND otp_expiry > NOW()",
      [mobile, otp],
    );

    if (users.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const user = users[0];

    // Update user as verified and clear OTP
    await db.query(
      "UPDATE users SET is_verified = TRUE, otp = NULL, otp_expiry = NULL, last_login = NOW() WHERE id = ?",
      [user.id],
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, mobile: user.mobile },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "30d" },
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "default_secret",
    );
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// GET /api/auth/me
// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, mobile, name, email, created_at FROM users WHERE id = ?",
      [req.userId],
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// PUT /api/auth/profile
// Update user profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;

    await db.query("UPDATE users SET name = ?, email = ? WHERE id = ?", [
      name,
      email,
      req.userId,
    ]);

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
