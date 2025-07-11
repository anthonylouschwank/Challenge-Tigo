const fs = require('fs');
const path = require('path');

class FileDatabaseManager {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../database');
    this.mocksFile = path.join(this.dbPath, 'mocks.json');
    this.logsFile = path.join(this.dbPath, 'logs.json');
    this.data = {
      mocks: [],
      logs: [],
      nextId: 1
    };
  }

  /**
   * Inicializa la base de datos de archivos
   */
  initialize() {
    try {
      console.log('🔄 Initializing file database...');
      
      // Crear directorio si no existe
      if (!fs.existsSync(this.dbPath)) {
        console.log(`📁 Creating directory: ${this.dbPath}`);
        fs.mkdirSync(this.dbPath, { recursive: true });
      }

      // Inicializar datos vacíos
      this.data = { mocks: [], logs: [], nextId: 1 };
      console.log('📋 Initialized empty data structure');

      // Cargar datos existentes o crear archivos nuevos
      this.loadData();
      
      console.log(`✅ File Database initialized at: ${this.dbPath}`);
      console.log(`📊 Initial stats: ${JSON.stringify(this.getStats())}`);
    } catch (error) {
      console.error('❌ Error initializing file database:', error);
      throw error;
    }
  }

  /**
   * Carga datos desde archivos
   */
  loadData() {
    try {
      console.log('📖 Loading data from files...');
      
      // Cargar mocks
      if (fs.existsSync(this.mocksFile)) {
        console.log(`📄 Mocks file exists: ${this.mocksFile}`);
        const mocksData = fs.readFileSync(this.mocksFile, 'utf8').trim();
        console.log(`📏 Mocks file size: ${mocksData.length} characters`);
        
        if (mocksData) {
          const parsed = JSON.parse(mocksData);
          this.data.mocks = parsed.mocks || [];
          this.data.nextId = parsed.nextId || 1;
          console.log(`✅ Loaded ${this.data.mocks.length} mocks`);
        } else {
          console.log('📄 Mocks file is empty, using defaults');
        }
      } else {
        console.log('📄 Mocks file does not exist, will create');
      }

      // Cargar logs
      if (fs.existsSync(this.logsFile)) {
        console.log(`📄 Logs file exists: ${this.logsFile}`);
        const logsData = fs.readFileSync(this.logsFile, 'utf8').trim();
        console.log(`📏 Logs file size: ${logsData.length} characters`);
        
        if (logsData) {
          this.data.logs = JSON.parse(logsData) || [];
          console.log(`✅ Loaded ${this.data.logs.length} logs`);
        } else {
          console.log('📄 Logs file is empty, using defaults');
        }
      } else {
        console.log('📄 Logs file does not exist, will create');
      }

      // Inicializar archivos si no existen o están vacíos
      console.log('💾 Saving initial data...');
      this.saveData();
      console.log('✅ Data loading completed');
    } catch (error) {
      console.error('❌ Error loading data:', error);
      console.error('📋 Stack trace:', error.stack);
      console.error('🔄 Reinitializing with empty data...');
      this.data = { mocks: [], logs: [], nextId: 1 };
      this.saveData();
    }
  }

  /**
   * Guarda datos a archivos
   */
  saveData() {
    try {
      // Asegurar que el directorio existe
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }

      // Guardar mocks
      const mocksContent = JSON.stringify({
        mocks: this.data.mocks || [],
        nextId: this.data.nextId || 1
      }, null, 2);
      fs.writeFileSync(this.mocksFile, mocksContent);

      // Guardar logs (solo los últimos 1000 para no llenar el disco)
      const recentLogs = (this.data.logs || []).slice(-1000);
      const logsContent = JSON.stringify(recentLogs, null, 2);
      fs.writeFileSync(this.logsFile, logsContent);
      
      console.log('📁 Data saved successfully');
    } catch (error) {
      console.error('❌ Error saving data:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo mock
   */
  createMock(mockData) {
    const mock = {
      id: this.data.nextId++,
      name: mockData.name,
      route: mockData.route,
      method: mockData.method.toUpperCase(),
      urlParams: mockData.urlParams || {},
      bodyParams: mockData.bodyParams || {},
      headers: mockData.headers || {},
      statusCode: mockData.statusCode || 200,
      responseBody: mockData.responseBody,
      contentType: mockData.contentType || 'application/json',
      conditions: mockData.conditions || {},
      enabled: mockData.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.mocks.push(mock);
    this.saveData();
    return mock;
  }

  /**
   * Busca un mock por ID
   */
  findMockById(id) {
    return this.data.mocks.find(mock => mock.id === parseInt(id));
  }

  /**
   * Busca mocks por ruta y método
   */
  findMocksByRouteAndMethod(route, method) {
    return this.data.mocks.filter(mock => 
      mock.route === route && 
      mock.method === method.toUpperCase() && 
      mock.enabled
    );
  }

  /**
   * Busca mocks por patrón de ruta
   */
  findMocksByRoutePattern(requestPath, method) {
    return this.data.mocks.filter(mock => {
      if (mock.method !== method.toUpperCase() || !mock.enabled) {
        return false;
      }
      return this.routeMatches(mock.route, requestPath);
    });
  }

  /**
   * Obtiene todos los mocks con paginación
   */
  findAllMocks(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const total = this.data.mocks.length;
    const mocks = this.data.mocks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(offset, offset + limit);

    return {
      data: mocks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Actualiza un mock
   */
  updateMock(id, updateData) {
    const index = this.data.mocks.findIndex(mock => mock.id === parseInt(id));
    if (index === -1) return null;

    this.data.mocks[index] = {
      ...this.data.mocks[index],
      ...updateData,
      id: parseInt(id), // Mantener el ID original
      updatedAt: new Date().toISOString()
    };

    this.saveData();
    return this.data.mocks[index];
  }

  /**
   * Elimina un mock
   */
  deleteMock(id) {
    const index = this.data.mocks.findIndex(mock => mock.id === parseInt(id));
    if (index === -1) return false;

    this.data.mocks.splice(index, 1);
    this.saveData();
    return true;
  }

  /**
   * Registra el uso de un mock
   */
  logMockUsage(mockId, requestData, responseData, executionTime) {
    const log = {
      id: Date.now(),
      mockId: parseInt(mockId),
      requestMethod: requestData.method,
      requestUrl: requestData.url,
      requestHeaders: requestData.headers,
      requestBody: requestData.body,
      responseStatus: responseData.status,
      responseBody: responseData.body,
      executionTimeMs: executionTime,
      timestamp: new Date().toISOString()
    };

    this.data.logs.push(log);
    
    // Mantener solo los últimos 1000 logs en memoria
    if (this.data.logs.length > 1000) {
      this.data.logs = this.data.logs.slice(-1000);
    }

    this.saveData();
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    try {
      console.log('📊 Getting database stats...');
      console.log(`📋 Data structure:`, {
        mocksLength: this.data.mocks ? this.data.mocks.length : 'undefined',
        logsLength: this.data.logs ? this.data.logs.length : 'undefined',
        nextId: this.data.nextId
      });
      
      const enabledMocks = this.data.mocks.filter(mock => mock.enabled).length;
      
      const stats = {
        totalMocks: this.data.mocks.length,
        enabledMocks: enabledMocks,
        totalLogs: this.data.logs.length,
        databasePath: this.dbPath,
        databaseSize: this.getDatabaseSize()
      };
      
      console.log('Stats calculated:', stats);
      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      console.error('Stack trace:', error.stack);
      return {
        totalMocks: 0,
        enabledMocks: 0,
        totalLogs: 0,
        databasePath: this.dbPath,
        databaseSize: 0,
        error: error.message
      };
    }
  }

  /**
   * Obtiene el tamaño de los archivos de base de datos
   */
  getDatabaseSize() {
    try {
      let size = 0;
      if (fs.existsSync(this.mocksFile)) {
        size += fs.statSync(this.mocksFile).size;
      }
      if (fs.existsSync(this.logsFile)) {
        size += fs.statSync(this.logsFile).size;
      }
      return size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Verifica si una ruta coincide con un patrón
   */
  routeMatches(pattern, path) {
    const regex = pattern
      .replace(/:[^\s/]+/g, '([^/]+)')
      .replace(/\*/g, '.*');
    
    const regexPattern = new RegExp(`^${regex}$`);
    return regexPattern.test(path);
  }

  /**
   * Extrae parámetros de la URL
   */
  extractUrlParams(pattern, path) {
    const paramNames = [];
    const regex = pattern.replace(/:[^\s/]+/g, (match) => {
      paramNames.push(match.slice(1));
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

  /**
   * Cierra la "conexión" (guarda datos)
   */
  close() {
    this.saveData();
    console.log('File database connection closed');
  }
}

module.exports = new FileDatabaseManager();