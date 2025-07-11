const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Importar database manager
const dbManager = require('./utils/fileDatabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar base de datos
try {
  dbManager.initialize();
} catch (error) {
  console.error('Failed to initialize database:', error);
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

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    console.log('Health check requested');
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

// Middleware para manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  console.error('Error stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  console.error('Request body:', req.body);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method
  });
});

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