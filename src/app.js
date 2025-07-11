const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Importar database manager y controladores
const dbManager = require('./utils/fileDatabase');
const configRoutes = require('./routes/configRoutes');
const MockController = require('./controllers/mockController');

// Importar middlewares personalizados
const middleware = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar base de datos
try {
  dbManager.initialize();
} catch (error) {
  console.error('❌ Failed to initialize database:', error);
  process.exit(1);
}

// Middleware
app.use(helmet()); // Seguridad básica
app.use(cors()); // CORS para permitir requests desde cualquier origen
app.use(morgan('combined')); // Logging de requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Solo aplicar JSON parsing a rutas específicas que lo necesitan
app.use('/configure-mock', express.json({ limit: '10mb' }));
app.use('/test', express.json({ limit: '10mb' }));

// Middleware global para manejar JSON en rutas de mocks (aplicar después de rutas del sistema)
app.use((req, res, next) => {
  // Aplicar JSON parsing a todas las rutas que NO son del sistema
  const systemRoutes = ['/health', '/', '/mock-stats', '/mock-logs'];
  const isSystemRoute = systemRoutes.includes(req.path) || 
                       req.path.startsWith('/configure-mock') || 
                       req.path.startsWith('/test');
  
  if (!isSystemRoute && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    express.json({ limit: '10mb' })(req, res, next);
  } else {
    next();
  }
});

// Rutas principales del sistema (estas NO deben ir al motor de matching)
app.use('/configure-mock', configRoutes);

// Endpoints específicos del sistema
app.get('/mock-stats', MockController.getMockStats);
app.delete('/mock-logs', MockController.clearOldLogs);

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    console.log('🔍 Health check requested');
    const dbStats = dbManager.getStats();
    console.log('Database stats:', dbStats);
    
    res.status(200).json({
      status: 'OK',
      message: 'Mock API is running!',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: dbStats
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de información de la API
app.get('/', (req, res) => {
  try {
    console.log('Root endpoint requested');
    res.json({
      name: 'Mock API',
      version: '1.0.0',
      description: 'API para mocks de servicios REST con configuración dinámica',
      endpoints: {
        health: 'GET /health',
        info: 'GET /',
        configureMock: 'POST /configure-mock (próximamente)',
        listMocks: 'GET /configure-mock (próximamente)',
        deleteMock: 'DELETE /configure-mock/:id (próximamente)'
      },
      documentation: 'https://github.com/tu-usuario/mock-api'
    });
  } catch (error) {
    console.error('Error in root endpoint:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint temporal para probar POST
app.post('/test', (req, res) => {
  res.json({
    message: 'POST request received successfully!',
    receivedData: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Endpoint temporal para probar diferentes métodos HTTP
app.get('/test/:id', (req, res) => {
  res.json({
    message: 'GET request with parameter',
    id: req.params.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

app.put('/test/:id', (req, res) => {
  res.json({
    message: 'PUT request received',
    id: req.params.id,
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

app.delete('/test/:id', (req, res) => {
  res.json({
    message: 'DELETE request received',
    id: req.params.id,
    timestamp: new Date().toISOString()
  });
});

// IMPORTANTE: Este middleware debe ir DESPUÉS de todas las rutas del sistema
// Intercepta TODAS las rutas que no son del sistema y las envía al motor de matching
app.use('*', (req, res, next) => {
  console.log(`🔍 Checking route: ${req.method} ${req.originalUrl}`);
  
  // Rutas del sistema que NO deben ir al motor de matching
  const systemPaths = ['/health', '/mock-stats', '/mock-logs'];
  const isConfigMockRoute = req.originalUrl.startsWith('/configure-mock');
  const isTestRoute = req.originalUrl.startsWith('/test');
  const isSystemPath = systemPaths.includes(req.originalUrl);
  const isRootAndGet = req.originalUrl === '/' && req.method === 'GET';
  
  if (isConfigMockRoute || isTestRoute || isSystemPath || isRootAndGet) {
    console.log(`System route, returning 404: ${req.originalUrl}`);
    return middleware.notFoundHandler(req, res);
  }
  
  console.log(`Sending to mock engine: ${req.method} ${req.originalUrl}`);
  // Para todas las demás rutas, intentar encontrar un mock
  MockController.handleMockRequest(req, res);
});

// Middleware global para manejo de errores (debe ir al final)
app.use(middleware.errorLogger);
app.use(middleware.globalErrorHandler);

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API info: http://localhost:${PORT}/`);
  console.log(`Database: ${dbManager.dbPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  dbManager.close();
  process.exit(0);
});

module.exports = app;