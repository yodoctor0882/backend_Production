// // src/middleware/upload.middleware.js

// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     if (!req.user || !req.user.role) {
//       return cb(new Error("Unauthorized upload"), null);
//     }

//     const role = req.user.role.toLowerCase(); // doctor | patient
//     const uploadPath = path.join("uploads", "profiles", `${role}s`);

//     fs.mkdirSync(uploadPath, { recursive: true });

//     cb(null, uploadPath);
//   },

//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();
//     const allowed = [".jpg", ".jpeg", ".png", ".webp"];

//     if (!allowed.includes(ext)) {
//       return cb(new Error("Invalid image format"), null);
//     }

//     cb(null, `user_${req.user.id}_${Date.now()}${ext}`);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   if (!file.mimetype.startsWith("image/")) {
//     return cb(new Error("Only image files allowed"), false);
//   }

//   cb(null, true);
// };

// module.exports = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
// });



const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const s3 = require("../config/s3");

// File filter
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "yodoctor.in",
    contentType: multerS3.AUTO_CONTENT_TYPE,

    key: (req, file, cb) => {
      if (!req.user || !req.user.role) {
        return cb(new Error("Unauthorized upload"), null);
      }

      const role = req.user.role.toLowerCase(); // doctor | patient
      const ext = path.extname(file.originalname).toLowerCase();
      const allowed = [".jpg", ".jpeg", ".png", ".webp"];

      if (!allowed.includes(ext)) {
        return cb(new Error("Invalid image format"), null);
      }

      // 🔥 Folder structure in S3
      const fileName = `profiles/${role}s/user_${req.user.id}_${Date.now()}${ext}`;

      cb(null, fileName);
    },
  }),

  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;