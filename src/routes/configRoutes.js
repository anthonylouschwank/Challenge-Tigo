const express = require('express');
const ConfigController = require('../controllers/configController');

const router = express.Router();

// POST /configure-mock - Crear nuevo mock
router.post('/', ConfigController.createMock);

// GET /configure-mock - Listar todos los mocks
router.get('/', ConfigController.listMocks);

// GET /configure-mock/:id - Obtener mock específico
router.get('/:id', ConfigController.getMockById);

// PUT /configure-mock/:id - Actualizar mock completo
router.put('/:id', ConfigController.updateMock);

// PATCH /configure-mock/:id/toggle - Habilitar/deshabilitar mock
router.patch('/:id/toggle', ConfigController.toggleMock);

// DELETE /configure-mock/:id - Eliminar mock
router.delete('/:id', ConfigController.deleteMock);

module.exports = router;