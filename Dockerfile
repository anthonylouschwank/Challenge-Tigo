FROM node:20-bullseye-slim

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo dentro del contenedor
WORKDIR /app

# Crear directorio para la base de datos
RUN mkdir -p /app/database

# Copiar package.json y package-lock.json primero (para aprovechar cache de Docker)
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar el resto del código fuente
COPY . .

# Crear usuario no-root para seguridad (sintaxis Debian)
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home mockapi

# Cambiar permisos del directorio de base de datos
RUN chown -R mockapi:nodejs /app/database
RUN chmod -R 755 /app/database

# Cambiar a usuario no-root
USER mockapi

# Exponer el puerto que usará la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]