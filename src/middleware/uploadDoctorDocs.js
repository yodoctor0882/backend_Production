// // src/middleware/uploadDoctorDocs.js

// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join("uploads", "doctors");

//     fs.mkdirSync(uploadPath, { recursive: true });

//     cb(null, uploadPath);
//   },

//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();
//     cb(null, `${Date.now()}-${file.fieldname}${ext}`);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = [
//     "image/jpeg",
//     "image/png",
//     "application/pdf",
//   ];

//   if (!allowedTypes.includes(file.mimetype)) {
//     return cb(new Error("Only JPG, PNG, or PDF files allowed"), false);
//   }

//   cb(null, true);
// };

// const uploadDoctorDocs = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 }, 
// }).fields([
//   { name: "profile", maxCount: 1 },
//   { name: "certificate", maxCount: 1 },
//   { name: "idProof", maxCount: 1 },
//   { name: "clinicProof", maxCount: 1 }, 
// ]);

// module.exports = uploadDoctorDocs;


const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const s3 = require("../config/s3");

// File filter (same as yours)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
    "application/octet-stream",
  ];

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(ext)
  ) {
    return cb(null, true);
  }

  return cb(new Error("Only JPG, PNG, or PDF files allowed"), false);
};

// S3 storage
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "yodoctor.in",
    contentType: multerS3.AUTO_CONTENT_TYPE,

    key: (req, file, cb) => {
      let folder = "others";

      // 🔥 Field-wise folder
      if (file.fieldname === "profile") {
        folder = "doctors/profile";
      } else if (file.fieldname === "certificate") {
        folder = "doctors/certificate";
      } else if (file.fieldname === "idProof") {
        folder = "doctors/idProof";
      } else if (file.fieldname === "clinicProof") {
        folder = "doctors/clinicProof";
      }

      const ext = path.extname(file.originalname).toLowerCase();
      const fileName = `${folder}/${Date.now()}-${file.fieldname}${ext}`;

      cb(null, fileName);
    },
  }),

  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Multi-file upload (same fields)
const uploadDoctorDocs = upload.fields([
  { name: "profile", maxCount: 1 },
  { name: "certificate", maxCount: 1 },
  { name: "idProof", maxCount: 1 },
  { name: "clinicProof", maxCount: 1 },
]);

module.exports = uploadDoctorDocs;