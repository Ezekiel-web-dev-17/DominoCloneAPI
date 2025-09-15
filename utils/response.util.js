export const successResponse = (res, payload = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    ...payload,
  });
};

export const errorResponse = (res, error, status = 500) => {
  if (typeof error === "string") {
    return res.status(status).json({
      success: false,
      message: error || "Server Error",
    });
  }

  return res.status(status).json({
    success: false,
    message: error.message || "Server Error",
  });
};
