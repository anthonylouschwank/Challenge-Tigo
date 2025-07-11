/**
 * Middleware para manejar errores no capturados
 */
const globalErrorHandler = (err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  console.error('📋 Error stack:', err.stack);
  console.error('🔗 Request URL:', req.url);
  console.error('📝 Request method:', req.method);
  console.error('📦 Request body:', req.body);
  console.error('🌐 Request headers:', req.headers);
  
  // Determinar el tipo de error y respuesta apropiada
  let statusCode = 500;
  let errorMessage = 'Internal Server Error';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = 'Validation Error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorMessage = 'Invalid Data Format';
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    errorMessage = 'Resource Not Found';
  } else if (err.code === 'EACCES') {
    statusCode = 403;
    errorMessage = 'Access Denied';
  }
  
  res.status(statusCode).json({
    error: errorMessage,
    message: err.message,
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Middleware para manejar rutas no encontradas del sistema
 */
const notFoundHandler = (req, res) => {
  console.log(`❌ System route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      system: [
        'GET /',
        'GET /health',
        'GET /mock-stats',
        'DELETE /mock-logs'
      ],
      configuration: [
        'POST /configure-mock',
        'GET /configure-mock',
        'GET /configure-mock/:id',
        'PUT /configure-mock/:id',
        'DELETE /configure-mock/:id',
        'PATCH /configure-mock/:id/toggle'
      ],
      testing: [
        'POST /test',
        'GET /test/:id',
        'PUT /test/:id',
        'DELETE /test/:id'
      ]
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware para manejar timeout de requests
 */
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`⏰ Request timeout: ${req.method} ${req.originalUrl}`);
        res.status(408).json({
          error: 'Request Timeout',
          message: `Request took longer than ${timeout}ms`,
          timestamp: new Date().toISOString()
        });
      }
    }, timeout);
    
    // Limpiar el timer cuando la response termine
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
};

/**
 * Middleware para logging de errores a archivo (opcional)
 */
const errorLogger = (err, req, res, next) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      ip: req.ip || req.connection.remoteAddress
    }
  };
  
  // En un entorno real, esto se guardaría en un archivo o sistema de logging
  console.error('📝 Error logged:', JSON.stringify(errorLog, null, 2));
  
  next(err);
};

module.exports = {
  globalErrorHandler,
  notFoundHandler,
  timeoutHandler,
  errorLogger
};