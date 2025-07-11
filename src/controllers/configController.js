const Joi = require('joi');
const dbManager = require('../utils/fileDatabase');

// Esquema de validación para crear mocks
const createMockSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
    .description('Nombre descriptivo del mock'),
  
  route: Joi.string().min(1).max(500).required()
    .pattern(/^\/.*/)
    .description('Ruta del endpoint (debe empezar con /)'),
  
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS').required()
    .description('Método HTTP'),
  
  urlParams: Joi.object().optional()
    .description('Parámetros esperados en la URL'),
  
  bodyParams: Joi.object().optional()
    .description('Parámetros esperados en el body'),
  
  headers: Joi.object().optional()
    .description('Headers requeridos'),
  
  statusCode: Joi.number().integer().min(100).max(599).default(200)
    .description('Código de estado HTTP de respuesta'),
  
  responseBody: Joi.alternatives().try(
    Joi.object(),
    Joi.array(),
    Joi.string(),
    Joi.number(),
    Joi.boolean()
  ).required()
    .description('Cuerpo de la respuesta'),
  
  contentType: Joi.string().default('application/json')
    .description('Content-Type de la respuesta'),
  
  conditions: Joi.object().optional()
    .description('Condiciones específicas para activar este mock'),
  
  enabled: Joi.boolean().default(true)
    .description('Si el mock está habilitado')
});

class ConfigController {
  /**
   * Crear un nuevo mock
   * POST /configure-mock
   */
  static async createMock(req, res) {
    try {
      console.log('🆕 Creating new mock configuration...');
      console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

      // Validar datos de entrada
      const { error, value } = createMockSchema.validate(req.body);
      if (error) {
        console.log('❌ Validation error:', error.details);
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid mock configuration',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        });
      }

      // Verificar si ya existe un mock con la misma ruta y método
      const existingMocks = dbManager.findMocksByRouteAndMethod(value.route, value.method);
      if (existingMocks.length > 0) {
        console.log('⚠️ Mock already exists for this route and method');
        return res.status(409).json({
          error: 'Conflict',
          message: `A mock already exists for ${value.method} ${value.route}`,
          existingMock: existingMocks[0],
          timestamp: new Date().toISOString()
        });
      }

      // Crear el mock
      const newMock = dbManager.createMock(value);
      console.log('✅ Mock created successfully:', newMock.id);

      res.status(201).json({
        message: 'Mock configuration created successfully',
        mock: newMock,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error creating mock:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create mock configuration',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Obtener lista de mocks
   * GET /configure-mock
   */
  static async listMocks(req, res) {
    try {
      console.log('📋 Listing mock configurations...');
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const enabled = req.query.enabled;

      console.log(`📄 Pagination: page=${page}, limit=${limit}`);

      // Obtener mocks con paginación
      const result = dbManager.findAllMocks(page, limit);
      
      // Filtrar por enabled si se especifica
      if (enabled !== undefined) {
        const isEnabled = enabled === 'true';
        result.data = result.data.filter(mock => mock.enabled === isEnabled);
        result.pagination.total = result.data.length;
        result.pagination.pages = Math.ceil(result.data.length / limit);
      }

      console.log(`✅ Found ${result.data.length} mocks`);

      res.json({
        message: 'Mock configurations retrieved successfully',
        mocks: result.data,
        pagination: result.pagination,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error listing mocks:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve mock configurations',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Obtener un mock específico por ID
   * GET /configure-mock/:id
   */
  static async getMockById(req, res) {
    try {
      const mockId = parseInt(req.params.id);
      console.log(`🔍 Getting mock by ID: ${mockId}`);

      if (isNaN(mockId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid mock ID',
          timestamp: new Date().toISOString()
        });
      }

      const mock = dbManager.findMockById(mockId);
      
      if (!mock) {
        console.log(`❌ Mock not found: ${mockId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: `Mock with ID ${mockId} not found`,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Mock found: ${mock.name}`);
      res.json({
        message: 'Mock configuration retrieved successfully',
        mock: mock,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error getting mock by ID:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve mock configuration',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Actualizar un mock existente
   * PUT /configure-mock/:id
   */
  static async updateMock(req, res) {
    try {
      const mockId = parseInt(req.params.id);
      console.log(`🔄 Updating mock ID: ${mockId}`);

      if (isNaN(mockId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid mock ID',
          timestamp: new Date().toISOString()
        });
      }

      // Validar datos de entrada (permitir campos parciales)
      const updateSchema = createMockSchema.fork(
        ['name', 'route', 'method', 'responseBody'], 
        (schema) => schema.optional()
      );

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        console.log('❌ Validation error:', error.details);
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid mock configuration',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        });
      }

      const updatedMock = dbManager.updateMock(mockId, value);
      
      if (!updatedMock) {
        console.log(`❌ Mock not found for update: ${mockId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: `Mock with ID ${mockId} not found`,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Mock updated successfully: ${mockId}`);
      res.json({
        message: 'Mock configuration updated successfully',
        mock: updatedMock,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error updating mock:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update mock configuration',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Eliminar un mock
   * DELETE /configure-mock/:id
   */
  static async deleteMock(req, res) {
    try {
      const mockId = parseInt(req.params.id);
      console.log(`🗑️ Deleting mock ID: ${mockId}`);

      if (isNaN(mockId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid mock ID',
          timestamp: new Date().toISOString()
        });
      }

      const deleted = dbManager.deleteMock(mockId);
      
      if (!deleted) {
        console.log(`❌ Mock not found for deletion: ${mockId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: `Mock with ID ${mockId} not found`,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Mock deleted successfully: ${mockId}`);
      res.json({
        message: 'Mock configuration deleted successfully',
        deletedId: mockId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error deleting mock:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete mock configuration',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Habilitar/deshabilitar un mock
   * PATCH /configure-mock/:id/toggle
   */
  static async toggleMock(req, res) {
    try {
      const mockId = parseInt(req.params.id);
      console.log(`🔄 Toggling mock ID: ${mockId}`);

      if (isNaN(mockId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid mock ID',
          timestamp: new Date().toISOString()
        });
      }

      const mock = dbManager.findMockById(mockId);
      if (!mock) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Mock with ID ${mockId} not found`,
          timestamp: new Date().toISOString()
        });
      }

      const updatedMock = dbManager.updateMock(mockId, { enabled: !mock.enabled });
      
      console.log(`✅ Mock toggled: ${mockId} - enabled: ${updatedMock.enabled}`);
      res.json({
        message: `Mock ${updatedMock.enabled ? 'enabled' : 'disabled'} successfully`,
        mock: updatedMock,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error toggling mock:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to toggle mock configuration',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = ConfigController;