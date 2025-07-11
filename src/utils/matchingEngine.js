const dbManager = require('./fileDatabase');

class MatchingEngine {
  /**
   * Busca mocks que coincidan con la request
   */
  static findMatchingMocks(requestPath, method, headers = {}, body = {}, query = {}) {
    console.log(`🔍 Searching mocks for: ${method} ${requestPath}`);
    
    try {
      // Buscar mocks exactos primero
      let mocks = dbManager.findMocksByRouteAndMethod(requestPath, method);
      
      // Si no encuentra exactos, buscar por patrones
      if (mocks.length === 0) {
        mocks = dbManager.findMocksByRoutePattern(requestPath, method);
      }
      
      console.log(`📋 Found ${mocks.length} potential mocks`);
      
      if (mocks.length === 0) {
        return null;
      }
      
      // Evaluar cada mock para encontrar el mejor match
      const matchResults = mocks.map(mock => {
        const score = this.calculateMatchScore(mock, requestPath, headers, body, query);
        return { mock, score };
      });
      
      // Ordenar por score descendente
      matchResults.sort((a, b) => b.score - a.score);
      
      // Retornar el mejor match si tiene score > 0
      const bestMatch = matchResults[0];
      if (bestMatch.score > 0) {
        console.log(`✅ Best match found: ${bestMatch.mock.name} (score: ${bestMatch.score})`);
        return bestMatch.mock;
      }
      
      console.log('❌ No suitable mock found');
      return null;
      
    } catch (error) {
      console.error('❌ Error in findMatchingMocks:', error);
      return null;
    }
  }
  
  /**
   * Calcula un score de coincidencia para un mock
   */
  static calculateMatchScore(mock, requestPath, headers, body, query) {
    let score = 100; // Score base
    
    try {
      // 1. Verificar que el mock esté habilitado
      if (!mock.enabled) {
        return 0;
      }
      
      // 2. Evaluar coincidencia de ruta
      const routeMatch = this.evaluateRouteMatch(mock.route, requestPath);
      if (!routeMatch.matches) {
        return 0;
      }
      score += routeMatch.score;
      
      // 3. Evaluar headers requeridos
      const headerMatch = this.evaluateHeadersMatch(mock.headers, headers);
      if (!headerMatch.matches) {
        console.log(`❌ Headers don't match for mock: ${mock.name}`);
        return 0;
      }
      score += headerMatch.score;
      
      // 4. Evaluar parámetros de URL requeridos
      const urlParamsMatch = this.evaluateUrlParamsMatch(mock.urlParams, routeMatch.extractedParams);
      if (!urlParamsMatch.matches) {
        console.log(`❌ URL params don't match for mock: ${mock.name}`);
        return 0;
      }
      score += urlParamsMatch.score;
      
      // 5. Evaluar parámetros de body requeridos
      const bodyParamsMatch = this.evaluateBodyParamsMatch(mock.bodyParams, body);
      if (!bodyParamsMatch.matches) {
        console.log(`❌ Body params don't match for mock: ${mock.name}`);
        return 0;
      }
      score += bodyParamsMatch.score;
      
      // 6. Evaluar condiciones específicas
      const conditionsMatch = this.evaluateConditions(mock.conditions, {
        headers,
        body,
        query,
        urlParams: routeMatch.extractedParams
      });
      if (!conditionsMatch.matches) {
        console.log(`❌ Conditions don't match for mock: ${mock.name}`);
        return 0;
      }
      score += conditionsMatch.score;
      
      console.log(`📊 Mock "${mock.name}" score: ${score}`);
      return score;
      
    } catch (error) {
      console.error(`❌ Error calculating score for mock ${mock.name}:`, error);
      return 0;
    }
  }
  
  /**
   * Evalúa si la ruta coincide y extrae parámetros
   */
  static evaluateRouteMatch(mockRoute, requestPath) {
    try {
      // Coincidencia exacta
      if (mockRoute === requestPath) {
        return { matches: true, score: 50, extractedParams: {} };
      }
      
      // Coincidencia con parámetros (:id, :name, etc.)
      const paramNames = [];
      const regexPattern = mockRoute.replace(/:[^\s/]+/g, (match) => {
        paramNames.push(match.slice(1)); // Remove ':'
        return '([^/]+)';
      });
      
      // Soporte para wildcards (*)
      const finalPattern = regexPattern.replace(/\*/g, '.*');
      
      const regex = new RegExp(`^${finalPattern}$`);
      const match = requestPath.match(regex);
      
      if (match) {
        const extractedParams = {};
        paramNames.forEach((name, index) => {
          extractedParams[name] = match[index + 1];
        });
        
        const score = paramNames.length > 0 ? 30 : 40; // Menos score para rutas con parámetros
        return { matches: true, score, extractedParams };
      }
      
      return { matches: false, score: 0, extractedParams: {} };
      
    } catch (error) {
      console.error('Error in evaluateRouteMatch:', error);
      return { matches: false, score: 0, extractedParams: {} };
    }
  }
  
  /**
   * Evalúa coincidencia de headers
   */
  static evaluateHeadersMatch(requiredHeaders, requestHeaders) {
    try {
      if (!requiredHeaders || Object.keys(requiredHeaders).length === 0) {
        return { matches: true, score: 0 };
      }
      
      let score = 0;
      
      for (const [key, expectedValue] of Object.entries(requiredHeaders)) {
        const actualValue = requestHeaders[key.toLowerCase()] || requestHeaders[key];
        
        if (!actualValue) {
          console.log(`❌ Missing required header: ${key}`);
          return { matches: false, score: 0 };
        }
        
        if (expectedValue === '*') {
          // Wildcard - cualquier valor es válido
          score += 5;
        } else if (expectedValue === actualValue) {
          // Coincidencia exacta
          score += 10;
        } else if (expectedValue.includes('*')) {
          // Patrón con wildcard
          const pattern = expectedValue.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`, 'i');
          if (regex.test(actualValue)) {
            score += 8;
          } else {
            console.log(`❌ Header ${key} doesn't match pattern: ${expectedValue}`);
            return { matches: false, score: 0 };
          }
        } else {
          console.log(`❌ Header ${key} doesn't match: expected ${expectedValue}, got ${actualValue}`);
          return { matches: false, score: 0 };
        }
      }
      
      return { matches: true, score };
      
    } catch (error) {
      console.error('Error in evaluateHeadersMatch:', error);
      return { matches: false, score: 0 };
    }
  }
  
  /**
   * Evalúa parámetros de URL extraídos
   */
  static evaluateUrlParamsMatch(requiredParams, extractedParams) {
    try {
      if (!requiredParams || Object.keys(requiredParams).length === 0) {
        return { matches: true, score: 0 };
      }
      
      let score = 0;
      
      for (const [key, validation] of Object.entries(requiredParams)) {
        const actualValue = extractedParams[key];
        
        if (actualValue === undefined) {
          console.log(`❌ Missing required URL param: ${key}`);
          return { matches: false, score: 0 };
        }
        
        if (validation === 'required') {
          score += 5;
        } else if (validation === 'number') {
          if (isNaN(actualValue)) {
            console.log(`❌ URL param ${key} is not a number: ${actualValue}`);
            return { matches: false, score: 0 };
          }
          score += 10;
        } else if (typeof validation === 'string' && validation !== actualValue) {
          console.log(`❌ URL param ${key} doesn't match: expected ${validation}, got ${actualValue}`);
          return { matches: false, score: 0 };
        } else {
          score += 5;
        }
      }
      
      return { matches: true, score };
      
    } catch (error) {
      console.error('Error in evaluateUrlParamsMatch:', error);
      return { matches: false, score: 0 };
    }
  }
  
  /**
   * Evalúa parámetros del body
   */
  static evaluateBodyParamsMatch(requiredParams, requestBody) {
    try {
      if (!requiredParams || Object.keys(requiredParams).length === 0) {
        return { matches: true, score: 0 };
      }
      
      let score = 0;
      
      for (const [key, validation] of Object.entries(requiredParams)) {
        const actualValue = requestBody[key];
        
        if (validation === 'required') {
          if (actualValue === undefined || actualValue === null || actualValue === '') {
            console.log(`❌ Missing required body param: ${key}`);
            return { matches: false, score: 0 };
          }
          score += 10;
        } else if (typeof validation === 'string' && validation !== 'required') {
          if (actualValue !== validation) {
            console.log(`❌ Body param ${key} doesn't match: expected ${validation}, got ${actualValue}`);
            return { matches: false, score: 0 };
          }
          score += 15;
        }
      }
      
      return { matches: true, score };
      
    } catch (error) {
      console.error('Error in evaluateBodyParamsMatch:', error);
      return { matches: false, score: 0 };
    }
  }
  
  /**
   * Evalúa condiciones específicas
   */
  static evaluateConditions(conditions, requestData) {
    try {
      if (!conditions || Object.keys(conditions).length === 0) {
        return { matches: true, score: 0 };
      }
      
      let score = 0;
      
      for (const [conditionPath, expectedValue] of Object.entries(conditions)) {
        const actualValue = this.getNestedValue(requestData, conditionPath);
        
        if (actualValue === undefined) {
          console.log(`❌ Condition path not found: ${conditionPath}`);
          return { matches: false, score: 0 };
        }
        
        if (expectedValue === actualValue) {
          score += 20;
        } else {
          console.log(`❌ Condition doesn't match: ${conditionPath} = ${actualValue}, expected ${expectedValue}`);
          return { matches: false, score: 0 };
        }
      }
      
      return { matches: true, score };
      
    } catch (error) {
      console.error('Error in evaluateConditions:', error);
      return { matches: false, score: 0 };
    }
  }
  
  /**
   * Obtiene valor anidado usando dot notation
   */
  static getNestedValue(obj, path) {
    try {
      return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
      }, obj);
    } catch (error) {
      return undefined;
    }
  }
  
  /**
   * Procesa la respuesta del mock con plantillas dinámicas
   */
  static processResponse(mock, requestData) {
    try {
      console.log(`🔄 Processing response for mock: ${mock.name}`);
      
      let responseBody = JSON.parse(JSON.stringify(mock.responseBody));
      
      // Reemplazar plantillas en la respuesta
      responseBody = this.replaceTemplates(responseBody, requestData);
      
      return {
        statusCode: mock.statusCode,
        contentType: mock.contentType,
        body: responseBody
      };
      
    } catch (error) {
      console.error('Error processing response:', error);
      return {
        statusCode: 500,
        contentType: 'application/json',
        body: { error: 'Error processing mock response' }
      };
    }
  }
  
  /**
   * Reemplaza plantillas dinámicas en la respuesta
   */
  static replaceTemplates(obj, requestData) {
    try {
      if (typeof obj === 'string') {
        // Reemplazar {{variable}} con valores reales
        return obj.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
          const value = this.getNestedValue(requestData, variable);
          return value !== undefined ? value : match;
        });
      } else if (Array.isArray(obj)) {
        return obj.map(item => this.replaceTemplates(item, requestData));
      } else if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = this.replaceTemplates(value, requestData);
        }
        return result;
      }
      
      return obj;
      
    } catch (error) {
      console.error('Error replacing templates:', error);
      return obj;
    }
  }
}

module.exports = MatchingEngine;