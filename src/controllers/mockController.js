const MatchingEngine = require('../utils/matchingEngine');
const dbManager = require('../utils/fileDatabase');

class MockController {
  /**
   * Maneja todas las requests y busca mocks correspondientes
   */
  static async handleMockRequest(req, res) {
    const startTime = Date.now();
    
    try {
      // Usar originalUrl para obtener la ruta completa
      const requestPath = req.originalUrl.split('?')[0]; // Remover query params
      
      console.log(`\n🎯 Mock request: ${req.method} ${requestPath}`);
      console.log(`📦 Headers:`, req.headers);
      console.log(`🔗 Query:`, req.query);
      console.log(`📄 Body:`, req.body);
      
      // Buscar mock que coincida
      const matchingMock = MatchingEngine.findMatchingMocks(
        requestPath,
        req.method,
        req.headers,
        req.body || {},
        req.query || {}
      );
      
      if (!matchingMock) {
        console.log(`❌ No mock found for: ${req.method} ${requestPath}`);
        return res.status(404).json({
          error: 'Mock Not Found',
          message: `No mock configuration found for ${req.method} ${requestPath}`,
          timestamp: new Date().toISOString(),
          suggestion: 'Create a mock configuration using POST /configure-mock'
        });
      }
      
      // Preparar datos de request para el procesamiento
      const requestData = {
        headers: req.headers,
        body: req.body || {},
        query: req.query || {},
        urlParams: MatchingEngine.evaluateRouteMatch(matchingMock.route, requestPath).extractedParams,
        method: req.method,
        path: requestPath
      };
      
      // Procesar respuesta con plantillas dinámicas
      const response = MatchingEngine.processResponse(matchingMock, requestData);
      
      // Calcular tiempo de ejecución
      const executionTime = Date.now() - startTime;
      
      // Registrar uso del mock para estadísticas
      dbManager.logMockUsage(
        matchingMock.id,
        {
          method: req.method,
          url: requestPath,
          headers: req.headers,
          body: req.body
        },
        {
          status: response.statusCode,
          body: response.body
        },
        executionTime
      );
      
      console.log(`✅ Mock executed: ${matchingMock.name} (${executionTime}ms)`);
      
      // Enviar respuesta
      res.status(response.statusCode)
        .set('Content-Type', response.contentType)
        .set('X-Mock-Name', matchingMock.name)
        .set('X-Mock-Id', matchingMock.id.toString())
        .set('X-Execution-Time', `${executionTime}ms`)
        .json(response.body);
        
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Error handling mock request:', error);
      
      res.status(500).json({
        error: 'Mock Execution Error',
        message: 'An error occurred while executing the mock',
        details: error.message,
        timestamp: new Date().toISOString(),
        executionTime: `${executionTime}ms`
      });
    }
  }
  
  /**
   * Obtiene estadísticas de uso de mocks
   */
  static async getMockStats(req, res) {
    try {
      const stats = dbManager.getStats();
      
      // Obtener logs recientes para estadísticas adicionales
      const recentLogs = dbManager.data.logs.slice(-100); // Últimos 100 logs
      
      const methodStats = {};
      const routeStats = {};
      let totalExecutionTime = 0;
      
      recentLogs.forEach(log => {
        // Estadísticas por método
        methodStats[log.requestMethod] = (methodStats[log.requestMethod] || 0) + 1;
        
        // Estadísticas por ruta
        const routeKey = `${log.requestMethod} ${log.requestUrl}`;
        routeStats[routeKey] = (routeStats[routeKey] || 0) + 1;
        
        // Tiempo total de ejecución
        totalExecutionTime += log.executionTimeMs || 0;
      });
      
      const avgExecutionTime = recentLogs.length > 0 
        ? Math.round(totalExecutionTime / recentLogs.length) 
        : 0;
      
      res.json({
        message: 'Mock statistics retrieved successfully',
        stats: {
          ...stats,
          recentRequests: recentLogs.length,
          averageExecutionTime: `${avgExecutionTime}ms`,
          methodDistribution: methodStats,
          popularRoutes: Object.entries(routeStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([route, count]) => ({ route, count }))
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting mock stats:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve mock statistics',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Limpia logs antiguos
   */
  static async clearOldLogs(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      
      if (days < 1) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Days parameter must be greater than 0',
          timestamp: new Date().toISOString()
        });
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const initialCount = dbManager.data.logs.length;
      dbManager.data.logs = dbManager.data.logs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );
      
      const removedCount = initialCount - dbManager.data.logs.length;
      dbManager.saveData();
      
      console.log(`🧹 Cleared ${removedCount} old logs (older than ${days} days)`);
      
      res.json({
        message: 'Old logs cleared successfully',
        removedLogs: removedCount,
        remainingLogs: dbManager.data.logs.length,
        cutoffDate: cutoffDate.toISOString(),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error clearing old logs:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to clear old logs',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = MockController;