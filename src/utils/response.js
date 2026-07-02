const success = (res, data = {}, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

const created = (res, data = {}, message = "Created successfully") => {
  return success(res, data, message, 201);
};

// ================= ERROR RESPONSES ===================

const error = (
  res,
  message = "Something went wrong",
  statusCode = 500,
  details = null,
  code = null,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
    timestamp: new Date().toISOString(),
  });
};

const badRequest = (res, message = "Bad Request", details = null) => {
  return error(res, message, 400, details);
};

const unauthorized = (res, message = "Unauthorized") => {
  return error(res, message, 401);
};

const forbidden = (res, message = "Forbidden") => {
  return error(res, message, 403);
};

const notFound = (res, message = "Resource not found") => {
  return error(res, message, 404);
};


module.exports = Object.freeze({
  success,
  created,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
});