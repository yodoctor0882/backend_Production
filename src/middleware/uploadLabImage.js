// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// const uploadPath = "uploads/lab-tests";

// if (!fs.existsSync(uploadPath)) {
//   fs.mkdirSync(uploadPath, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadPath);
//   },

//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, Date.now() + ext);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   if (!file.mimetype.startsWith("image/")) {
//     return cb(new Error("Only image files are allowed"), false);
//   }

//   cb(null, true);
// };

// module.exports = multer({
//   storage,
//   fileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024,
//   },
// });

// middleware/labTestUpload.js

const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const s3 = require("../config/s3");

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(ext)
  ) {
    return cb(null, true);
  }

  return cb(
    new Error("Only JPG, JPEG, PNG, or WEBP image files are allowed"),
    false,
  );
};

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "yodoctor.in",

    contentType: multerS3.AUTO_CONTENT_TYPE,

    key: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();

      const fileName = `lab-tests/${Date.now()}-${file.fieldname}${ext}`;

      cb(null, fileName);
    },
  }),

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = upload;
