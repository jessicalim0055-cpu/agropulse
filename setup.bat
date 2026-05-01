@echo off
echo ============================================
echo  AgroPulse Setup
echo ============================================
echo.

echo [1/3] Installing Python backend dependencies...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (echo ERROR: pip install failed. Make sure Python 3.11+ is installed. && pause && exit /b 1)
echo.

echo [2/3] Copying .env.example to .env...
if not exist .env (
  copy .env.example .env
  echo DONE: Open backend\.env and paste your ANTHROPIC_API_KEY
) else (
  echo SKIP: .env already exists
)
echo.

echo [3/3] Installing Node.js frontend dependencies...
cd ..\frontend
npm install
if %errorlevel% neq 0 (echo ERROR: npm install failed. Make sure Node.js 18+ is installed. && pause && exit /b 1)
echo.

echo ============================================
echo  Setup complete!
echo.
echo  NEXT STEPS:
echo  1. Edit agropulse\backend\.env
echo     Set ANTHROPIC_API_KEY=sk-ant-...
echo.
echo  2. Start the backend (Terminal 1):
echo     cd agropulse\backend
echo     uvicorn main:app --reload
echo.
echo  3. Start the frontend (Terminal 2):
echo     cd agropulse\frontend
echo     npm run dev
echo.
echo  4. Open http://localhost:5173
echo ============================================
pause
