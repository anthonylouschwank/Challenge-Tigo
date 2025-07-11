const express = require('express');

/**
 * Middleware para parsing JSON condicional
 * Solo aplica a rutas que realmente necesitan parsing JSON
 */
const conditionalJsonParser = (req, res, next) => {
  // Aplicar JSON parsing a todas las rutas que NO son del sistema
  const systemRoutes = ['/health', '/', '/mock-stats', '/mock-logs'];
  const isSystemRoute = systemRoutes.includes(req.path) || 
                       req.path.startsWith('/configure-mock') || 
                       req.path.startsWith('/test');
  
  if (!isSystemRoute && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    console.log(`Applying JSON parser to: ${req.method} ${req.path}`);
    express.json({ limit: '10mb' })(req, res, next);
  } else {
    next();
  }
};

/**
 * Middleware para manejar errores de parsing JSON
 */
const jsonParsingErrorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parsing error:', err.message);
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

/**
 * Middleware para validar Content-Type en requests POST/PUT
 */
const validateContentType = (req, res, next) => {
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && 
      req.headers['content-length'] && 
      req.headers['content-length'] !== '0') {
    
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      console.log(`Invalid Content-Type: ${contentType} for ${req.method} ${req.path}`);
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json for POST/PUT requests with body',
        received: contentType || 'none',
        timestamp: new Date().toISOString()
      });
    }
  }
  next();
};

/**
 * Middleware para logging de requests (más detallado que Morgan)
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log inicial de la request
  console.log(`\n ${req.method} ${req.originalUrl}`);
  console.log(`IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`User-Agent: ${req.headers['user-agent']}`);
  
  if (Object.keys(req.query).length > 0) {
    console.log(`Query params:`, req.query);
  }
  
  // Interceptar el final de la response para logging
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`Response: ${res.statusCode} (${duration}ms)`);
    
    if (res.statusCode >= 400) {
      console.log(`Error response body:`, body);
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

module.exports = {
  conditionalJsonParser,
  jsonParsingErrorHandler,
  validateContentType,
  requestLogger
};