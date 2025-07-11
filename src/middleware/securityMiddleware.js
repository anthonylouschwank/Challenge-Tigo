/**
 * Middleware para rate limiting básico
 */
const rateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Limpiar requests antiguos
    for (const [ip, data] of requests) {
      if (now - data.windowStart > windowMs) {
        requests.delete(ip);
      }
    }
    
    // Obtener o crear datos del cliente
    let clientData = requests.get(clientId);
    if (!clientData || now - clientData.windowStart > windowMs) {
      clientData = {
        count: 0,
        windowStart: now
      };
      requests.set(clientId, clientData);
    }
    
    clientData.count++;
    
    // Verificar límite
    if (clientData.count > maxRequests) {
      console.log(`Rate limit exceeded for IP: ${clientId}`);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000} seconds`,
        retryAfter: Math.ceil((windowMs - (now - clientData.windowStart)) / 1000),
        timestamp: new Date().toISOString()
      });
    }
    
    // Agregar headers informativos
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.count),
      'X-RateLimit-Reset': new Date(clientData.windowStart + windowMs).toISOString()
    });
    
    next();
  };
};

/**
 * Middleware para validar tamaño de payload
 */
const payloadSizeValidator = (maxSize = 10 * 1024 * 1024) => { // 10MB por defecto
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      console.log(`Payload too large: ${contentLength} bytes (max: ${maxSize})`);
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request payload exceeds maximum size of ${maxSize} bytes`,
        received: parseInt(contentLength),
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

/**
 * Middleware para sanitizar headers peligrosos
 */
const headerSanitizer = (req, res, next) => {
  // Remover headers potencialmente peligrosos
  const dangerousHeaders = ['x-forwarded-host', 'x-forwarded-proto'];
  
  dangerousHeaders.forEach(header => {
    if (req.headers[header]) {
      console.log(`🧹 Sanitizing header: ${header}`);
      delete req.headers[header];
    }
  });
  
  // Agregar headers de seguridad a la respuesta
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  next();
};

/**
 * Middleware para logging de actividad sospechosa
 */
const suspiciousActivityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /[<>\"']/g,  // Posibles XSS
    /union\s+select/i,  // SQL injection
    /script/i,  // Scripts
    /javascript:/i,  // JavaScript URLs
    /eval\(/i,  // Eval calls
    /\.\.\/\.\./,  // Path traversal
  ];
  
  const url = req.originalUrl;
  const userAgent = req.headers['user-agent'] || '';
  
  // Verificar patrones sospechosos
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(userAgent)) {
      console.warn('Suspicious activity detected:');
      console.warn(`   IP: ${req.ip || req.connection.remoteAddress}`);
      console.warn(`   URL: ${url}`);
      console.warn(`   User-Agent: ${userAgent}`);
      console.warn(`   Pattern matched: ${pattern}`);
      break;
    }
  }
  
  next();
};

/**
 * Middleware para validar métodos HTTP permitidos
 */
const methodValidator = (allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']) => {
  return (req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
      console.log(`Method not allowed: ${req.method}`);
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `HTTP method ${req.method} is not allowed`,
        allowedMethods,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

module.exports = {
  rateLimiter,
  payloadSizeValidator,
  headerSanitizer,
  suspiciousActivityLogger,
  methodValidator
};