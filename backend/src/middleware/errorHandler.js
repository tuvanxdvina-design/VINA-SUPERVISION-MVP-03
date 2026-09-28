// Global error handler middleware
exports.errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn (tệp tối đa 15 MB)' });
  
  // Database errors
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Foreign key constraint violation' });
  }
  
  // Generic error
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
};