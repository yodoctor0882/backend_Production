// utils/generateCertId.js

exports.generateCertificateId = () => {
  const year = new Date().getFullYear();

  // random 6 digit number → total ~10 digit
  const random = Math.floor(100000 + Math.random() * 900000);

  return `MC-${year}-${random}`;
};