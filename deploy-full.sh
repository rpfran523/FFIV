#!/bin/bash

# Full deployment script for Flower Fairies to AWS
set -e

echo "🚀 Flower Fairies AWS Deployment"
echo "================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    echo "   On macOS: Open /Applications/Docker.app"
    exit 1
fi

# Load AWS credentials
if [ -f "deploy-aws.env" ]; then
    export $(cat deploy-aws.env | xargs)
    echo "✅ AWS credentials loaded"
else
    echo "❌ deploy-aws.env not found"
    exit 1
fi

# Configuration
ECR_REPOSITORY="flower-fairies"
IMAGE_TAG="latest"
AWS_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# Get AWS account ID
echo "🔍 Getting AWS account information..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Failed to authenticate with AWS. Please check your credentials."
    exit 1
fi

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"

echo "📦 Building Docker image locally..."
docker build -f infra/azure-webapp.dockerfile -t $ECR_REPOSITORY:$IMAGE_TAG .

echo ""
echo "🧪 Running container locally for testing (http://localhost:8080)..."
echo "   Press Ctrl+C to stop and continue with deployment"
echo ""

# Create a test .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cat > .env << EOF
NODE_ENV=development
PORT=8080
DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/flower_fairies
JWT_ACCESS_SECRET=test-access-secret
JWT_REFRESH_SECRET=test-refresh-secret
CORS_ORIGIN=http://localhost:8080
EOF
fi

# Run container in background
docker run -d --name flower-fairies-test \
    -p 8080:8080 \
    --env-file .env \
    $ECR_REPOSITORY:$IMAGE_TAG

echo "✅ Container started. Testing health endpoint..."
sleep 5

# Test health endpoint
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed, but continuing..."
fi

# Stop test container
docker stop flower-fairies-test && docker rm flower-fairies-test

echo ""
echo "📤 Deploying to AWS ECR..."
echo "============================"

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Create repository if it doesn't exist
echo "📁 Creating ECR repository if needed..."
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION

# Tag and push image
echo "📤 Pushing image to ECR..."
docker tag $ECR_REPOSITORY:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
docker push $ECR_URI:$IMAGE_TAG

echo ""
echo "✅ Deployment to ECR completed!"
echo "================================"
echo ""
echo "Image URI: $ECR_URI:$IMAGE_TAG"
echo ""
echo "🚀 Next Steps - Deploy with App Runner:"
echo "======================================="
echo ""
echo "1. Create an App Runner service:"
echo ""
cat << EOF
aws apprunner create-service \\
  --service-name flower-fairies \\
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "$ECR_URI:$IMAGE_TAG",
      "ImageConfiguration": {
        "Port": "8080",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "DATABASE_URL": "YOUR_RDS_CONNECTION_STRING",
          "JWT_ACCESS_SECRET": "YOUR_SECURE_SECRET",
          "JWT_REFRESH_SECRET": "YOUR_SECURE_SECRET",
          "REDIS_URL": "YOUR_ELASTICACHE_URL"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false
  }'
EOF

echo ""
echo "2. Or deploy with ECS/Fargate:"
echo "   - Create a task definition with the image: $ECR_URI:$IMAGE_TAG"
echo "   - Set up an Application Load Balancer"
echo "   - Configure environment variables"
echo ""
echo "3. Set up RDS PostgreSQL:"
echo "   - Create RDS instance"
echo "   - Run schema.sql and seed.sql"
echo "   - Update DATABASE_URL in your service"
echo ""
echo "⚠️  SECURITY REMINDER:"
echo "   DELETE deploy-aws.env and ROTATE your AWS credentials immediately!"
echo ""

# Clean up
rm -f deploy-aws.env
echo "✅ Removed deploy-aws.env for security"
