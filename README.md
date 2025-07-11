# 🎭 Mock API - Simulador de Servicios REST

Una API completa para crear y gestionar mocks de servicios REST con configuración dinámica, validaciones avanzadas y respuestas personalizadas.

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Uso Básico](#-uso-básico)
- [Documentación de API](#-documentación-de-api)
- [Ejemplos Avanzados](#-ejemplos-avanzados)
- [Configuración](#-configuración)
- [Arquitectura](#-arquitectura)
- [Desarrollo](#-desarrollo)
- [Troubleshooting](#-troubleshooting)

## 🚀 Características

- ✅ **Configuración Dinámica**: Crea mocks sin reiniciar el servidor
- ✅ **Motor de Matching Inteligente**: Coincidencias por ruta, método, headers y parámetros
- ✅ **Respuestas Dinámicas**: Plantillas con variables `{{variable}}`
- ✅ **Validaciones Avanzadas**: Headers, body params y condiciones personalizadas
- ✅ **Persistencia**: Base de datos SQLite/JSON para configuraciones
- ✅ **Estadísticas**: Logs de uso y métricas en tiempo real
- ✅ **Seguridad**: Rate limiting, validaciones y sanitización
- ✅ **Docker Ready**: Contenedor listo para producción
- ✅ **API REST Completa**: CRUD completo para gestión de mocks

## 📦 Requisitos Previos

### 1. Docker (Recomendado)
- **Docker Desktop** para Windows/Mac
- **Docker Engine** para Linux

#### Instalación de Docker:

**Windows/Mac:**
1. Descargar [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Ejecutar el instalador
3. Reiniciar el sistema
4. Verificar instalación:
   ```bash
   docker --version
   docker-compose --version
   ```

## 🛠️ Instalación y Configuración

### Con Docker (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/mock-api.git
cd mock-api

# 2. Ejecutar con Docker
docker-compose up --build

# ¡Listo! La API estará disponible en http://localhost:3000
```

### Verificar Instalación

```bash
# Verificar que la API esté funcionando
curl http://localhost:3000/health
```

**Respuesta esperada:**
```json
{
  "status": "OK",
  "message": "Mock API is running!",
  "database": {
    "totalMocks": 0,
    "enabledMocks": 0
  }
}
```

## 🎯 Uso Básico

### 1. Crear tu primer mock

```bash
curl -X POST http://localhost:3000/configure-mock \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lista de usuarios",
    "route": "/api/users",
    "method": "GET",
    "responseBody": {
      "users": [
        {"id": 1, "name": "Juan Pérez", "email": "juan@empresa.com"},
        {"id": 2, "name": "María García", "email": "maria@empresa.com"}
      ],
      "total": 2
    }
  }'
```

### 2. Probar el mock

```bash
curl http://localhost:3000/api/users
```

**Respuesta:**
```json
{
  "users": [
    {"id": 1, "name": "Juan Pérez", "email": "juan@empresa.com"},
    {"id": 2, "name": "María García", "email": "maria@empresa.com"}
  ],
  "total": 2
}
```

### 3. Ver todos los mocks

```bash
curl http://localhost:3000/configure-mock
```

### 4. Ver estadísticas

```bash
curl http://localhost:3000/mock-stats
```

## 📚 Documentación de API

### Endpoints del Sistema

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado de la API |
| `/` | GET | Información general |
| `/mock-stats` | GET | Estadísticas de uso |
| `/mock-logs` | DELETE | Limpiar logs antiguos |

### Endpoints de Configuración

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/configure-mock` | POST | Crear nuevo mock |
| `/configure-mock` | GET | Listar todos los mocks |
| `/configure-mock/:id` | GET | Obtener mock específico |
| `/configure-mock/:id` | PUT | Actualizar mock |
| `/configure-mock/:id` | DELETE | Eliminar mock |
| `/configure-mock/:id/toggle` | PATCH | Habilitar/deshabilitar mock |

### Estructura de un Mock

```json
{
  "name": "string (requerido)",
  "route": "string (requerido, debe empezar con /)",
  "method": "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS (requerido)",
  "urlParams": "object (opcional)",
  "bodyParams": "object (opcional)",
  "headers": "object (opcional)",
  "statusCode": "number (opcional, default: 200)",
  "responseBody": "any (requerido)",
  "contentType": "string (opcional, default: application/json)",
  "conditions": "object (opcional)",
  "enabled": "boolean (opcional, default: true)"
}
```

## 🎨 Ejemplos Avanzados

### Mock con Parámetros Dinámicos

```json
{
  "name": "Usuario por ID",
  "route": "/api/users/:id",
  "method": "GET",
  "responseBody": {
    "id": "{{urlParams.id}}",
    "name": "Usuario {{urlParams.id}}",
    "email": "user{{urlParams.id}}@empresa.com",
    "created_at": "2025-07-11T19:00:00Z"
  }
}
```

**Prueba:**
```bash
curl http://localhost:3000/api/users/123
# Respuesta: {"id": "123", "name": "Usuario 123", ...}
```

### Mock con Validación de Headers

```json
{
  "name": "Datos protegidos",
  "route": "/api/protected",
  "method": "GET",
  "headers": {
    "authorization": "Bearer *"
  },
  "conditions": {
    "headers.user-role": "admin"
  },
  "responseBody": {
    "data": "Información confidencial",
    "access_level": "admin"
  }
}
```

**Prueba:**
```bash
curl http://localhost:3000/api/protected \
  -H "Authorization: Bearer token123" \
  -H "User-Role: admin"
```

### Mock con Validación de Body

```json
{
  "name": "Crear usuario",
  "route": "/api/users",
  "method": "POST",
  "bodyParams": {
    "name": "required",
    "email": "required"
  },
  "statusCode": 201,
  "responseBody": {
    "id": 999,
    "name": "{{body.name}}",
    "email": "{{body.email}}",
    "created_at": "2025-07-11T19:00:00Z"
  }
}
```

**Prueba:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Carlos López", "email": "carlos@empresa.com"}'
```

### Mock de Error

```json
{
  "name": "Usuario no encontrado",
  "route": "/api/users/:id",
  "method": "GET",
  "conditions": {
    "urlParams.id": "999"
  },
  "statusCode": 404,
  "responseBody": {
    "error": "User not found",
    "message": "User with ID 999 does not exist"
  }
}
```

### Mock con Wildcard

```json
{
  "name": "API Legacy deprecated",
  "route": "/legacy/*",
  "method": "GET",
  "statusCode": 410,
  "responseBody": {
    "error": "API deprecated",
    "message": "Please use /api/v2 instead"
  }
}
```

## ⚙️ Configuración

### Variables de Entorno

```env
# Puerto de la aplicación
PORT=3000

# Entorno de ejecución
NODE_ENV=production

# Ruta de la base de datos
DB_PATH=./database/mocks.db

# Nivel de logging
LOG_LEVEL=info
```

### Configuración de Docker

```yaml
# docker-compose.yml personalizado
version: '3.8'
services:
  mock-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./database:/app/database
```

## 🏗️ Arquitectura

```
src/
├── controllers/         # Lógica de negocio
│   ├── configController.js
│   └── mockController.js
├── middleware/          # Middlewares personalizados
│   ├── errorMiddleware.js
│   ├── securityMiddleware.js
│   ├── validationMiddleware.js
│   └── index.js
├── models/             # (Futuro: modelos de datos)
├── routes/             # Definición de rutas
│   └── configRoutes.js
├── utils/              # Utilidades
│   ├── fileDatabase.js
│   └── matchingEngine.js
└── app.js             # Aplicación principal
```

### Motor de Matching

El motor evalúa mocks en este orden:
1. **Coincidencia exacta** de ruta y método
2. **Coincidencia por patrón** (con parámetros `:id`)
3. **Validación de headers** requeridos
4. **Validación de parámetros** de body/URL
5. **Evaluación de condiciones** específicas
6. **Selección por puntuación** (score más alto gana)

## 👨‍💻 Desarrollo

### Ejecutar en modo desarrollo

```bash
# Con hot-reload
docker-compose --profile dev up --build

# O sin Docker
npm run dev
```

### Ver logs en tiempo real

```bash
docker-compose logs -f mock-api
```

### Acceder al contenedor

```bash
docker exec -it mock-api-service /bin/bash
```

## 🐛 Troubleshooting

### Problemas Comunes

#### 1. "Port already in use"
```bash
# Verificar qué proceso usa el puerto 3000
lsof -i :3000

# Cambiar puerto
PORT=3001 docker-compose up
```

#### 2. "Cannot find module"
```bash
# Limpiar y reinstalar
docker-compose down
docker-compose up --build
```

#### 3. Mock no responde
```bash
# Verificar que el mock existe
curl http://localhost:3000/configure-mock

# Verificar logs
docker-compose logs mock-api | grep "Mock request"
```

### Headers de Debug

Los mocks incluyen headers informativos:
- `X-Mock-Name`: Nombre del mock ejecutado
- `X-Mock-Id`: ID del mock
- `X-Execution-Time`: Tiempo de procesamiento
- `X-RateLimit-*`: Información de rate limiting

## 📊 Métricas y Monitoreo

### Estadísticas Disponibles

- **Total de mocks**: Configurados en el sistema
- **Mocks habilitados**: Actualmente activos
- **Requests totales**: Procesadas por el sistema
- **Tiempo promedio**: De ejecución de mocks
- **Rutas populares**: Más utilizadas
- **Distribución por método**: GET, POST, etc.

### Endpoints de Monitoreo

```bash
# Estadísticas generales
curl http://localhost:3000/mock-stats

# Health check completo
curl http://localhost:3000/health

# Limpiar logs antiguos (más de 7 días)
curl -X DELETE http://localhost:3000/mock-logs?days=7
```

---

**¿Necesitas ayuda?** 
- 📧 Email: anthonylouschwank@gmail.com
