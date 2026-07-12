const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

module.exports = s3;


// const { S3Client } = require("@aws-sdk/client-s3");

// const requiredEnv = [
//   "AWS_REGION",
//   "AWS_ACCESS_KEY_ID",
//   "AWS_SECRET_ACCESS_KEY",
// ];

// for (const key of requiredEnv) {
//   if (!process.env[key]) {
//     throw new Error(`Missing environment variable: ${key}`);
//   }
// }

// const s3 = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// module.exports = s3;