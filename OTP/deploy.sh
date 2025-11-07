#!/bin/bash

# Production Deployment Script for OTP Leads Application
# This script prepares the application for production deployment

set -e

echo "🚀 Starting production deployment preparation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        exit 1
    fi
    
    print_status "Requirements check passed ✓"
}

# Validate environment variables
validate_env() {
    print_status "Validating environment variables..."
    
    if [ ! -f ".env.production" ]; then
        print_warning ".env.production file not found, copying from template..."
        cp .env.production.template .env.production
        print_error "Please edit .env.production with your actual values before deploying"
        exit 1
    fi
    
    # Check critical variables
    source .env.production
    
    if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "your_production_database_url_here" ]; then
        print_error "DATABASE_URL is not configured in .env.production"
        exit 1
    fi
    
    if [ -z "$SUPABASE_PROJECT_URL" ] || [ "$SUPABASE_PROJECT_URL" = "your_supabase_project_url_here" ]; then
        print_error "SUPABASE_PROJECT_URL is not configured in .env.production"
        exit 1
    fi
    
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_jwt_secret_here_min_32_characters" ]; then
        print_error "JWT_SECRET is not configured in .env.production"
        exit 1
    fi
    
    print_status "Environment validation passed ✓"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    npm ci --production=false
    
    # Build client
    cd client
    npm ci --production=false
    npm run build
    cd ..
    
    print_status "Dependencies installed and client built ✓"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Run all tests
    npm run test
    
    # Run TypeScript check
    npm run check
    
    print_status "Tests passed ✓"
}

# Database migration
migrate_database() {
    print_status "Running database migrations..."
    
    # Push schema to database
    npm run db:push
    
    print_status "Database migration completed ✓"
}

# Security audit
security_audit() {
    print_status "Running security audit..."
    
    # Check for security vulnerabilities
    npm audit --audit-level=high
    
    print_status "Security audit completed ✓"
}

# Build optimization
optimize_build() {
    print_status "Optimizing build..."
    
    # Remove development dependencies
    npm prune --production
    
    # Optimize client build
    cd client
    npm run build:prod
    cd ..
    
    print_status "Build optimization completed ✓"
}

# Create deployment package
create_package() {
    print_status "Creating deployment package..."
    
    # Create deployment directory
    mkdir -p deployment
    
    # Copy necessary files
    cp -r server deployment/
    cp -r client/dist deployment/client
    cp package.json deployment/
    cp package-lock.json deployment/
    cp .env.production deployment/
    cp vercel.json deployment/
    
    # Create deployment archive
    tar -czf deployment.tar.gz deployment/
    
    print_status "Deployment package created: deployment.tar.gz ✓"
}

# Main deployment function
main() {
    print_status "Starting production deployment process..."
    
    check_requirements
    validate_env
    install_dependencies
    run_tests
    migrate_database
    security_audit
    optimize_build
    create_package
    
    print_status "🎉 Production deployment preparation completed!"
    print_status "Your application is ready for deployment to Vercel"
    print_status "Next steps:"
    print_status "1. Upload deployment.tar.gz to your hosting provider"
    print_status "2. Configure environment variables in your hosting platform"
    print_status "3. Deploy using: vercel --prod"
    print_status "4. Run health checks after deployment"
}

# Run main function
main "$@"