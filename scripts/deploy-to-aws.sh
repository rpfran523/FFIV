#!/bin/bash

# Flower Fairies AWS Deployment Script
# This script builds and uploads the Docker image to AWS ECR

set -e

echo "🚀 Starting AWS deployment process..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
ECR_REPOSITORY=${ECR_REPOSITORY:-"flower-fairies"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Failed to get AWS account ID. Please configure AWS credentials."
    exit 1
fi

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"

echo "📦 Building Docker image..."
docker build -f infra/azure-webapp.dockerfile -t $ECR_REPOSITORY:$IMAGE_TAG .

echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Create repository if it doesn't exist
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION

echo "📤 Tagging and pushing image to ECR..."
docker tag $ECR_REPOSITORY:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
docker push $ECR_URI:$IMAGE_TAG

echo "✅ Docker image pushed successfully to ECR!"
echo "Image URI: $ECR_URI:$IMAGE_TAG"
echo ""
echo "Next steps:"
echo "1. Deploy to ECS/EKS/App Runner using this image"
echo "2. Set up environment variables in your AWS service"
echo "3. Configure database and Redis connections"
echo ""
echo "Example deployment with App Runner:"
echo "aws apprunner create-service \\"
echo "  --service-name flower-fairies \\"
echo "  --source-configuration '{"
echo "    \"ImageRepository\": {"
echo "      \"ImageIdentifier\": \"$ECR_URI:$IMAGE_TAG\","
echo "      \"ImageConfiguration\": {"
echo "        \"Port\": \"8080\","
echo "        \"RuntimeEnvironmentVariables\": {"
echo "          \"NODE_ENV\": \"production\""
echo "        }"
echo "      },"
echo "      \"ImageRepositoryType\": \"ECR\""
echo "    },"
echo "    \"AutoDeploymentsEnabled\": false"
echo "  }'"
