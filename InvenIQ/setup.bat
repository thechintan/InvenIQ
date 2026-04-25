@echo off
echo ================================================
echo   InvenIQ - Setup Script
echo   AI-Powered Inventory Management System  
echo ================================================
echo.

REM Step 1: Create Database
echo [1/6] Creating PostgreSQL database...
set PGPASSWORD=Chint@n1
psql -U postgres -h localhost -p 5432 -c "DROP DATABASE IF EXISTS inveniq;"
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE inveniq;"
echo      Database created!
echo.

REM Step 2: Run Schema
echo [2/6] Running database schema...
psql -U postgres -h localhost -p 5432 -d inveniq -f database\schema.sql
echo      Schema applied!
echo.

REM Step 3: Install Backend Dependencies
echo [3/6] Installing backend dependencies...
cd backend
call npm install
cd ..
echo      Backend deps installed!
echo.

REM Step 4: Install Frontend Dependencies
echo [4/6] Installing frontend dependencies...
cd frontend
call npm install
cd ..
echo      Frontend deps installed!
echo.

REM Step 5: Seed Database
echo [5/6] Seeding database with sample data...
cd backend
call node seed.js
cd ..
echo      Database seeded!
echo.

REM Step 6: Install Python Dependencies
echo [6/6] Installing Python ML dependencies...
pip install -r ml\requirements.txt
echo      Python deps installed!
echo.

echo ================================================
echo   Setup Complete! 
echo.
echo   To start the application:
echo   1. Open Terminal 1: cd backend ^&^& npm run dev
echo   2. Open Terminal 2: cd frontend ^&^& npm run dev
echo.
echo   Then open: http://localhost:5173
echo.
echo   Login: admin@inveniq.com / Admin@123
echo ================================================
pause
