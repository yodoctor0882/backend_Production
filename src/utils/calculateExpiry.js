// utils/calculateExpiry.js

exports.calculateExpiry = (validity) => {
  const now = new Date();

  switch (validity) {
    case "1 month":
      now.setMonth(now.getMonth() + 1);
      break;
    case "3 months":
      now.setMonth(now.getMonth() + 3);
      break;
    case "6 months":
      now.setMonth(now.getMonth() + 6);
      break;
    case "1 year":
      now.setFullYear(now.getFullYear() + 1);
      break;
    default:
      now.setMonth(now.getMonth() + 1);
  }

  return now;
};