const { invalidateCanonicalCache } = require("../services/calibrationCanonicalService");

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXCLUDED_CALIBRATION_SUFFIXES = ["/pumps/bulk"];

const shouldInvalidateForRequest = (req) => {
  if (!MUTATION_METHODS.has(req.method)) {
    return false;
  }
  if (
    req.method === "POST" &&
    EXCLUDED_CALIBRATION_SUFFIXES.some((suffix) =>
      req.path.endsWith(suffix),
    )
  ) {
    return false;
  }
  return true;
};

const invalidateCanonicalCacheOnMutation = (req, res, next) => {
  if (!shouldInvalidateForRequest(req)) {
    return next();
  }

  let statusCode = res.statusCode;

  const originalStatus = res.status.bind(res);
  res.status = function status(code) {
    statusCode = code;
    return originalStatus(code);
  };

  const invalidateOnSuccess = () => {
    if (statusCode >= 200 && statusCode < 300) {
      invalidateCanonicalCache();
    }
  };

  const originalJson = res.json.bind(res);
  res.json = function json(body) {
    invalidateOnSuccess();
    return originalJson(body);
  };

  const originalSend = res.send.bind(res);
  res.send = function send(body) {
    invalidateOnSuccess();
    return originalSend(body);
  };

  next();
};

module.exports = invalidateCanonicalCacheOnMutation;
