FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (Render uses PORT environment variable)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]
