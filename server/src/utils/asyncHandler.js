// Express 4 doesn't forward a rejected promise from an async route handler
// to the error-handling middleware automatically - it just hangs the
// request. Wrap every handler with this so thrown/rejected errors always
// reach the generic error handler in server.js (which turns Mongoose
// ValidationError/CastError into clean 400s).
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
