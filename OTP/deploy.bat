@echo off
REM Production Deployment Script for OTP Leads Application
REM This script prepares the application for production deployment

echo 🚀 Starting production deployment preparation...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    exit /b 1
)

REM Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed
    exit /b 1
)

echo [INFO] Requirements check passed ✓

REM Validate environment variables
echo [INFO] Validating environment variables...

if not exist ".env.production" (
    echo [WARNING] .env.production file not found, copying from template...
    copy .env.production.template .env.production
    echo [ERROR] Please edit .env.production with your actual values before deploying
    exit /b 1
)

echo [INFO] Environment validation passed ✓

REM Install dependencies
echo [INFO] Installing dependencies...

echo [INFO] Installing root dependencies...
call npm ci --production=false
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install root dependencies
    exit /b 1
)

echo [INFO] Building client...
cd client
call npm ci --production=false
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install client dependencies
    exit /b 1
)
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build client
    exit /b 1
)
cd ..

echo [INFO] Dependencies installed and client built ✓

REM Run tests
echo [INFO] Running tests...
call npm run test
if %errorlevel% neq 0 (
    echo [ERROR] Tests failed
    exit /b 1
)

call npm run check
if %errorlevel% neq 0 (
    echo [ERROR] TypeScript check failed
    exit /b 1
)

echo [INFO] Tests passed ✓

REM Database migration
echo [INFO] Running database migrations...
call npm run db:push
if %errorlevel% neq 0 (
    echo [ERROR] Database migration failed
    exit /b 1
)
echo [INFO] Database migration completed ✓

REM Security audit
echo [INFO] Running security audit...
call npm audit --audit-level=high
echo [INFO] Security audit completed ✓

REM Build optimization
echo [INFO] Optimizing build...
call npm prune --production
echo [INFO] Build optimization completed ✓

REM Create deployment package
echo [INFO] Creating deployment package...

REM Create deployment directory
if not exist "deployment" mkdir deployment

REM Copy necessary files
xcopy /E /I /Y server deployment\server
xcopy /E /I /Y client\dist deployment\client
copy /Y package.json deployment\
copy /Y package-lock.json deployment\
copy /Y .env.production deployment\
copy /Y vercel.json deployment\

REM Create deployment archive
echo [INFO] Creating deployment archive...
powershell -Command "Compress-Archive -Path 'deployment' -DestinationPath 'deployment.zip' -Force"

echo [INFO] Deployment package created: deployment.zip ✓

echo 🎉 Production deployment preparation completed!
echo Your application is ready for deployment to Vercel
echo Next steps:
echo 1. Upload deployment.zip to your hosting provider
echo 2. Configure environment variables in your hosting platform
echo 3. Deploy using: vercel --prod
echo 4. Run health checks after deployment

pause