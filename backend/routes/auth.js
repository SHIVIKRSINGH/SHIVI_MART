const express = require("express");
const router = express.Router();
const db = require("../config/database");
const jwt = require("jsonwebtoken");

// Helper function to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to send OTP via WhatsApp using MSG91
// async function sendWhatsAppOTP(mobile, otp) {
//   try {
//     const axios = require("axios");

//     // Format mobile number
//     let formattedMobile = mobile.replace(/[\s\-\(\)\+]/g, "");
//     if (!formattedMobile.startsWith("91")) {
//       formattedMobile = "91" + formattedMobile;
//     }

//     const payload = {
//       integrated_number: "919818932110",
//       content_type: "template",
//       payload: {
//         messaging_product: "whatsapp",
//         type: "template",
//         template: {
//           language: {
//             code: "en",
//             policy: "deterministic",
//           },
//           to_and_components: [
//             {
//               to: [formattedMobile],
//               components: {
//                 body_1: {
//                   type: "text",
//                   value: otp,
//                 },
//               },
//             },
//           ],
//         },
//       },
//     };

//     console.log("📱 Sending WhatsApp OTP to:", formattedMobile);
//     console.log("📦 Full Payload:", JSON.stringify(payload, null, 2));

//     const response = await axios.post(
//       "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       },
//     );

//     console.log("✅ MSG91 API Response Status:", response.status);
//     console.log(
//       "✅ MSG91 API Response Data:",
//       JSON.stringify(response.data, null, 2),
//     );
//     console.log("✅ WhatsApp OTP sent successfully");

//     return {
//       success: true,
//       message: "OTP sent successfully",
//       data: response.data,
//     };
//   } catch (error) {
//     console.error("❌ WhatsApp OTP Error Details:");
//     console.error("   Status:", error.response?.status);
//     console.error("   Status Text:", error.response?.statusText);
//     console.error(
//       "   Response Data:",
//       JSON.stringify(error.response?.data, null, 2),
//     );
//     console.error("   Error Message:", error.message);
//     console.error("   Request URL:", error.config?.url);
//     console.error(
//       "   Request Headers:",
//       JSON.stringify(error.config?.headers, null, 2),
//     );

//     // Fallback - log OTP in development
//     console.log(`📱 DEV MODE - OTP for ${mobile}: ${otp}`);

//     return {
//       success: false,
//       message: "Failed to send WhatsApp OTP",
//       error: error.response?.data || error.message,
//     };
//   }
// }

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

    const AUTH_KEY = "513005A7fRzpVJ69f42f2cP1";
    const INTEGRATED_NUMBER = "919818932110";
    const TEMPLATE_NAMESPACE = "8e8f020c_bc47_4bdc_b4a6_9d5465a895a5";

    const payload = {
      integrated_number: INTEGRATED_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "otp_auth",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: TEMPLATE_NAMESPACE,
          to_and_components: [
            {
              to: [formattedMobile],
              components: {
                body_1: {
                  // Only ONE variable {{1}} for OTP
                  type: "text",
                  value: otp,
                },
                button_1: {
                  subtype: "url",
                  type: "text",
                  value: "<{{url text variable}}>",
                },
                // REMOVED body_2 because template only has {{1}}
              },
            },
          ],
        },
      },
    };

    console.log("📱 Sending WhatsApp OTP to:", formattedMobile);
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          authkey: AUTH_KEY,
        },
      },
    );

    console.log(
      "✅ Success! Response:",
      JSON.stringify(response.data, null, 2),
    );

    return {
      success: true,
      message: "OTP sent successfully via WhatsApp",
      data: response.data,
    };
  } catch (error) {
    console.error("❌ WhatsApp OTP Error:");
    console.error("Status:", error.response?.status);
    console.error("Error Data:", JSON.stringify(error.response?.data, null, 2));
    console.error("Message:", error.message);

    // Fallback for development
    if (process.env.NODE_ENV === "development") {
      console.log(`📱 DEV MODE - OTP for ${mobile}: ${otp}`);
    }

    return {
      success: false,
      message: "Failed to send WhatsApp OTP",
      error: error.response?.data || error.message,
    };
  }
}

module.exports = { generateOTP, sendWhatsAppOTP };
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
      "SELECT id, mobile, name, email, default_address, created_at FROM users WHERE id = ?",
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
    const { name, email, address } = req.body;

    await db.query(
      "UPDATE users SET name = ?, email = ?, default_address = ? WHERE id = ?",
      [name, email || null, address || null, req.userId],
    );

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
