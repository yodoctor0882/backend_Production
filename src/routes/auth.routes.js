const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload.middleware");
const authController = require("../controllers/authController");
const express = require("express");
const { authLimiter } = require("../middleware/rateLimit");
const router = express.Router();

router.post("/login", authLimiter,authController.login);
router.post("/forgot-password", authLimiter,authController.forgotPassword);
router.post("/verify-reset", authLimiter,authController.verifyReset);
router.post("/reset-password", authLimiter,authController.resetPassword);

// verifyOtp
// router.post("/verify-otp", authController.verifyOtp);

// PROFILE IMAGE UPLOAD
router.post(
  "/upload-profile-image",
  verifyToken, 
  upload.single("image"), 
  authController.uploadProfileImage,
);

router.put(
  "/updateprofile-image",
  verifyToken,
  upload.single("image"),
  authController.uploadProfileImage,
);

router.get(
  "/getprofile-image",
  verifyToken,  
  authController.getProfileImage,
);


router.delete(
  "/deleteprofile-image",
  verifyToken,
  authController.deleteProfileImage
);

router.post("/google-login", authLimiter,authController.googleLogin);

router.delete("/account-deletion", verifyToken, authController.deleteAccount);

module.exports = router;
