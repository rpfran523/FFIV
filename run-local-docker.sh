#!/bin/bash

# Script to run Flower Fairies in Docker locally

echo "🐳 Running Flower Fairies in Docker"
echo "==================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop:"
    echo "   macOS: Open /Applications/Docker.app"
    echo ""
    echo "Alternative: Run without Docker:"
    echo "   npm install"
    echo "   npm run dev"
    exit 1
fi

# Create test environment file
echo "📝 Creating test environment..."
cat > .env.docker << EOF
NODE_ENV=development
PORT=8080
DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/flower_fairies
JWT_ACCESS_SECRET=local-test-access-secret-change-in-production
JWT_REFRESH_SECRET=local-test-refresh-secret-change-in-production
CORS_ORIGIN=http://localhost:8080
EOF

# Build image
echo "🔨 Building Docker image..."
docker build -f infra/azure-webapp.dockerfile -t flower-fairies:local .

# Stop any existing container
docker stop flower-fairies-local 2>/dev/null || true
docker rm flower-fairies-local 2>/dev/null || true

# Run container
echo "🚀 Starting container..."
docker run -d \
    --name flower-fairies-local \
    -p 8080:8080 \
    --env-file .env.docker \
    flower-fairies:local

echo ""
echo "✅ Container started!"
echo ""
echo "📍 Application URL: http://localhost:8080"
echo "📍 API Health: http://localhost:8080/health"
echo ""
echo "📋 Useful commands:"
echo "   View logs:  docker logs -f flower-fairies-local"
echo "   Stop:       docker stop flower-fairies-local"
echo "   Remove:     docker rm flower-fairies-local"
echo ""
echo "Note: The app will fail to connect to PostgreSQL unless you have it running locally."
echo "For full functionality, set up PostgreSQL and update DATABASE_URL in .env.docker"

# Follow logs
echo ""
echo "Following logs (Ctrl+C to exit)..."
docker logs -f flower-fairies-local
