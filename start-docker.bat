@echo off
echo ========================================
echo   Voice AI Platform - Docker Startup
echo ========================================
echo.

REM Check if Docker is running
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Check if .env file exists
if not exist "backend\.env" (
    echo [WARNING] backend\.env file not found!
    echo.
    echo Creating from template...
    copy .env.example backend\.env
    echo.
    echo [ACTION REQUIRED] Please edit backend\.env with your API keys:
    echo - GEMINI_API_KEY
    echo - DEEPGRAM_API_KEY
    echo - ELEVENLABS_API_KEY
    echo.
    echo Then run this script again.
    pause
    exit /b 0
)

echo [OK] Environment file found
echo.

echo Starting services...
echo This may take 2-3 minutes on first run (downloading images)
echo.

docker-compose up -d

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start services!
    echo Run: docker-compose logs
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Services Starting...
echo ========================================
echo.
echo Waiting for services to be healthy (30 seconds)...
timeout /t 30 /nobreak >nul

echo.
echo Checking service health...
docker-compose ps

echo.
echo ========================================
echo   Access Your Application
echo ========================================
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:5000
echo MongoDB:   localhost:27017
echo ChromaDB:  http://localhost:8000
echo.
echo To view logs:    docker-compose logs -f
echo To stop:         docker-compose down
echo.
echo ========================================

pause
