const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Prueba basica de funcionamiento de docker
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Seguridad básica
app.use(cors()); // CORS para permitir requests desde cualquier origen
app.use(morgan('combined')); // Logging de requests
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Mock API is running!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Endpoint de información de la API
app.get('/', (req, res) => {
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
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mock API running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API info: http://localhost:${PORT}/`);
});

module.exports = app;