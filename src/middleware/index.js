const validationMiddleware = require('./validationMiddleware');
const errorMiddleware = require('./errorMiddleware');
const securityMiddleware = require('./securityMiddleware');

module.exports = {
  // Middlewares de validación
  conditionalJsonParser: validationMiddleware.conditionalJsonParser,
  jsonParsingErrorHandler: validationMiddleware.jsonParsingErrorHandler,
  validateContentType: validationMiddleware.validateContentType,
  requestLogger: validationMiddleware.requestLogger,
  
  // Middlewares de errores
  globalErrorHandler: errorMiddleware.globalErrorHandler,
  notFoundHandler: errorMiddleware.notFoundHandler,
  timeoutHandler: errorMiddleware.timeoutHandler,
  errorLogger: errorMiddleware.errorLogger,
  
  // Middlewares de seguridad
  rateLimiter: securityMiddleware.rateLimiter,
  payloadSizeValidator: securityMiddleware.payloadSizeValidator,
  headerSanitizer: securityMiddleware.headerSanitizer,
  suspiciousActivityLogger: securityMiddleware.suspiciousActivityLogger,
  methodValidator: securityMiddleware.methodValidator
};