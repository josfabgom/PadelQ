@echo off
echo ==============================================
echo Iniciando PadelQ Entorno Local (Sin Docker)
echo ==============================================

echo [1] Iniciando API (Backend)...
start "PadelQ API" cmd /k "cd PadelQ.Api && dotnet run --launch-profile http"

echo [2] Iniciando Admin Web (Frontend)...
start "PadelQ Admin Web" cmd /k "cd PadelQ.AdminWeb && npm install && npm run dev"

echo [3] Iniciando Mobile App (Flutter Web)...
start "PadelQ Mobile App" cmd /k "cd PadelQ.MobileApp && flutter run -d chrome"

echo ==============================================
echo Todos los servicios se han iniciado en nuevas ventanas.
echo.
echo Accesos:
echo - API (Swagger): http://localhost:5041/swagger
echo - Admin Web: (ver la consola de Vite, usualmente http://localhost:5173)
echo - Mobile App: (se abrira en una nueva ventana de Chrome)
echo ==============================================
pause
