const dbManager = require('../utils/fileDatabase');

class MockModel {
  constructor() {
    this.db = dbManager.getDatabase();
  }

  /**
   * Crea un nuevo mock
   */
  create(mockData) {
    try {
      const {
        name,
        route,
        method,
        urlParams = {},
        bodyParams = {},
        headers = {},
        statusCode = 200,
        responseBody,
        contentType = 'application/json',
        conditions = {},
        enabled = true
      } = mockData;

      const insertQuery = this.db.prepare(`
        INSERT INTO mocks (
          name, route, method, url_params, body_params, headers, 
          status_code, response_body, content_type, conditions, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertQuery.run(
        name,
        route,
        method.toUpperCase(),
        JSON.stringify(urlParams),
        JSON.stringify(bodyParams),
        JSON.stringify(headers),
        statusCode,
        JSON.stringify(responseBody),
        contentType,
        JSON.stringify(conditions),
        enabled ? 1 : 0
      );

      return this.findById(result.lastInsertRowid);
    } catch (error) {
      console.error('Error creating mock:', error);
      throw new Error(`Failed to create mock: ${error.message}`);
    }
  }

  /**
   * Busca un mock por ID
   */
  findById(id) {
    try {
      const query = this.db.prepare('SELECT * FROM mocks WHERE id = ?');
      const mock = query.get(id);
      
      if (mock) {
        return this.deserializeMock(mock);
      }
      return null;
    } catch (error) {
      console.error('Error finding mock by ID:', error);
      return null;
    }
  }

  /**
   * Busca mocks que coincidan con ruta y método
   */
  findByRouteAndMethod(route, method) {
    try {
      const query = this.db.prepare(`
        SELECT * FROM mocks 
        WHERE route = ? AND method = ? AND enabled = 1
        ORDER BY created_at DESC
      `);
      
      const mocks = query.all(route, method.toUpperCase());
      return mocks.map(mock => this.deserializeMock(mock));
    } catch (error) {
      console.error('Error finding mocks by route and method:', error);
      return [];
    }
  }

  /**
   * Busca mocks con coincidencia de patrón en la ruta
   */
  findByRoutePattern(requestPath, method) {
    try {
      const query = this.db.prepare(`
        SELECT * FROM mocks 
        WHERE method = ? AND enabled = 1
        ORDER BY created_at DESC
      `);
      
      const mocks = query.all(method.toUpperCase());
      const matchingMocks = [];

      for (const mock of mocks) {
        if (this.routeMatches(mock.route, requestPath)) {
          matchingMocks.push(this.deserializeMock(mock));
        }
      }

      return matchingMocks;
    } catch (error) {
      console.error('Error finding mocks by route pattern:', error);
      return [];
    }
  }

  /**
   * Obtiene todos los mocks con paginación
   */
  findAll(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const countQuery = this.db.prepare('SELECT COUNT(*) as total FROM mocks');
      const total = countQuery.get().total;
      
      const query = this.db.prepare(`
        SELECT * FROM mocks 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `);
      
      const mocks = query.all(limit, offset);
      
      return {
        data: mocks.map(mock => this.deserializeMock(mock)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error finding all mocks:', error);
      return { data: [], pagination: { page: 1, limit, total: 0, pages: 0 } };
    }
  }

  /**
   * Actualiza un mock
   */
  update(id, updateData) {
    try {
      const existing = this.findById(id);
      if (!existing) {
        return null;
      }

      const {
        name,
        route,
        method,
        urlParams,
        bodyParams,
        headers,
        statusCode,
        responseBody,
        contentType,
        conditions,
        enabled
      } = updateData;

      const updateQuery = this.db.prepare(`
        UPDATE mocks SET
          name = COALESCE(?, name),
          route = COALESCE(?, route),
          method = COALESCE(?, method),
          url_params = COALESCE(?, url_params),
          body_params = COALESCE(?, body_params),
          headers = COALESCE(?, headers),
          status_code = COALESCE(?, status_code),
          response_body = COALESCE(?, response_body),
          content_type = COALESCE(?, content_type),
          conditions = COALESCE(?, conditions),
          enabled = COALESCE(?, enabled),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateQuery.run(
        name || null,
        route || null,
        method ? method.toUpperCase() : null,
        urlParams ? JSON.stringify(urlParams) : null,
        bodyParams ? JSON.stringify(bodyParams) : null,
        headers ? JSON.stringify(headers) : null,
        statusCode || null,
        responseBody ? JSON.stringify(responseBody) : null,
        contentType || null,
        conditions ? JSON.stringify(conditions) : null,
        enabled !== undefined ? (enabled ? 1 : 0) : null,
        id
      );

      return this.findById(id);
    } catch (error) {
      console.error('Error updating mock:', error);
      throw new Error(`Failed to update mock: ${error.message}`);
    }
  }

  /**
   * Elimina un mock
   */
  delete(id) {
    try {
      const existing = this.findById(id);
      if (!existing) {
        return false;
      }

      const deleteQuery = this.db.prepare('DELETE FROM mocks WHERE id = ?');
      const result = deleteQuery.run(id);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting mock:', error);
      return false;
    }
  }

  /**
   * Registra el uso de un mock (para estadísticas)
   */
  logMockUsage(mockId, requestData, responseData, executionTime) {
    try {
      const logQuery = this.db.prepare(`
        INSERT INTO mock_logs (
          mock_id, request_method, request_url, request_headers, 
          request_body, response_status, response_body, execution_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      logQuery.run(
        mockId,
        requestData.method,
        requestData.url,
        JSON.stringify(requestData.headers),
        JSON.stringify(requestData.body),
        responseData.status,
        JSON.stringify(responseData.body),
        executionTime
      );
    } catch (error) {
      console.error('Error logging mock usage:', error);
    }
  }

  /**
   * Deserializa un mock de la base de datos
   */
  deserializeMock(dbMock) {
    try {
      return {
        id: dbMock.id,
        name: dbMock.name,
        route: dbMock.route,
        method: dbMock.method,
        urlParams: JSON.parse(dbMock.url_params || '{}'),
        bodyParams: JSON.parse(dbMock.body_params || '{}'),
        headers: JSON.parse(dbMock.headers || '{}'),
        statusCode: dbMock.status_code,
        responseBody: JSON.parse(dbMock.response_body),
        contentType: dbMock.content_type,
        conditions: JSON.parse(dbMock.conditions || '{}'),
        enabled: Boolean(dbMock.enabled),
        createdAt: dbMock.created_at,
        updatedAt: dbMock.updated_at
      };
    } catch (error) {
      console.error('Error deserializing mock:', error);
      return dbMock;
    }
  }

  /**
   * Verifica si una ruta coincide con un patrón
   */
  routeMatches(pattern, path) {
    // Convertir patrón con parámetros (/api/users/:id) a regex
    const regex = pattern
      .replace(/:[^\s/]+/g, '([^/]+)')  // :id -> ([^/]+)
      .replace(/\*/g, '.*');           // * -> .*
    
    const regexPattern = new RegExp(`^${regex}$`);
    return regexPattern.test(path);
  }

  /**
   * Extrae parámetros de la URL basado en el patrón
   */
  extractUrlParams(pattern, path) {
    const paramNames = [];
    const regex = pattern.replace(/:[^\s/]+/g, (match) => {
      paramNames.push(match.slice(1)); // Remove ':' prefix
      return '([^/]+)';
    });

    const regexPattern = new RegExp(`^${regex}$`);
    const match = path.match(regexPattern);

    if (!match) return {};

    const params = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return params;
  }
}

module.exports = MockModel;