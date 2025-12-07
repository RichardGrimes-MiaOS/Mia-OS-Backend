#!/bin/bash
set -e

log() { echo -e "\033[0;36m[$(date +'%Y-%m-%d %H:%M:%S')]\033[0m $1"; }
error() { echo -e "\033[0;31m[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:\033[0m $1" >&2; exit 1; }
success() { echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')]\033[0m $1"; }

log "Starting deployment process..."

log "Authenticating with ECR..."
aws ecr get-login-password --profile mia --region us-east-2 | \
  docker login --username AWS --password-stdin 963665911712.dkr.ecr.us-east-2.amazonaws.com || error "ECR authentication failed"

log "Building Docker image..."
docker build -t mia-development-backend:latest . || error "Docker build failed"

log "Tagging image..."
docker tag mia-development-backend:latest \
  963665911712.dkr.ecr.us-east-2.amazonaws.com/mia-development-backend:latest || error "Image tagging failed"

log "Pushing to ECR..."
docker push 963665911712.dkr.ecr.us-east-2.amazonaws.com/mia-development-backend:latest || error "ECR push failed"

success "Deployment completed successfully"