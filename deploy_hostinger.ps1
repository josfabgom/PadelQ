# --- SCRIPT DE DESPLIEGUE AUTOMÁTICO PARA HOSTINGER (PADELQ) ---
# Autor: Antigravity AI
# Uso: .\deploy_hostinger.ps1

$SERVER_IP = "31.97.19.119"
$USER = "root"
$TARGET_DIR = "/var/www/padelq"
$PACKAGE_NAME = "padelq_deploy.tar.gz"

# Resolver la ruta de Flutter de forma segura
$rawFlutterPath = "$PSScriptRoot\sdks\flutter\bin\flutter.bat"
$fso = New-Object -ComObject Scripting.FileSystemObject
$shortPath = $fso.GetFile($rawFlutterPath).ShortPath
$FLUTTER_EXE = $shortPath

# Crear un puente sin espacios si es necesario para evitar el bug de 'objective_c'
$BUILD_ROOT = $PSScriptRoot
if ($PSScriptRoot -like "* *") {
    $JUNCTION_PATH = "D:\PadelQ_Build"
    if (!(Test-Path $JUNCTION_PATH)) {
        New-Item -ItemType Junction -Path $JUNCTION_PATH -Value $PSScriptRoot
    }
    $BUILD_ROOT = $JUNCTION_PATH
    Write-Host "🔗 Usando puente virtual sin espacios: $BUILD_ROOT" -ForegroundColor Gray
}

Write-Host "`n🚀 Iniciando despliegue automático en Hostinger (Modo Híbrido)...`n" -ForegroundColor Cyan

# 1. Compilar App Móvil (Flutter) - Necesita ruta sin espacios
Write-Host "📱 Ejecutando code generation (build_runner)..." -ForegroundColor Yellow
Set-Location "$BUILD_ROOT\PadelQ.MobileApp"
& $FLUTTER_EXE pub run build_runner build --delete-conflicting-outputs
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo build_runner"; Set-Location $PSScriptRoot; exit }

Write-Host "📱 Compilando App Móvil para producción (Usando puente)..." -ForegroundColor Yellow
& $FLUTTER_EXE build web --release --dart-define=API_URL=https://api.blackclubdepadel.com.ar
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo la compilación de la App Móvil"; Set-Location $PSScriptRoot; exit }

# Volver a la ruta original para el resto (Vite prefiere la ruta real)
Set-Location $PSScriptRoot

# 2. Compilar Admin Web
Write-Host "📦 Compilando Admin Web para producción (Ruta Real)..." -ForegroundColor Yellow
cd PadelQ.AdminWeb
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo la compilación de Admin Web"; exit }
cd ..

# 2. Asegurar que las carpetas de compilación estén en la raíz para Docker
if (Test-Path ".\dist") { Remove-Item -Path ".\dist" -Recurse -Force }
Move-Item -Path ".\PadelQ.AdminWeb\dist" -Destination ".\dist" -Force

if (Test-Path ".\build\web") { Remove-Item -Path ".\build\web" -Recurse -Force }
if (Test-Path ".\PadelQ.MobileApp\build\web") {
    if (!(Test-Path ".\build")) { New-Item -ItemType Directory -Path ".\build" }
    Copy-Item -Path ".\PadelQ.MobileApp\build\web" -Destination ".\build\web" -Recurse -Force
}

# 3. Empaquetar solo lo necesario (Selectivo)
Write-Host "🗜️ Empaquetando archivos para transferencia (Modo Selectivo)..." -ForegroundColor Yellow
# Definimos los componentes críticos para producción (Incluyendo 'build' para la app móvil)
$FILES_TO_PACK = "PadelQ.Api", "PadelQ.Application", "PadelQ.Domain", "PadelQ.Infrastructure", "PadelQ.AdminWeb", "dist", "build", ".env", "docker-compose.yml.hostinger", "nginx.conf", "frontend.nginx.conf"
tar -czf $PACKAGE_NAME --exclude="bin" --exclude="obj" --exclude="node_modules" $FILES_TO_PACK

# 4. Subir el paquete al servidor
Write-Host "📤 Subiendo paquete a $USER@$SERVER_IP..." -ForegroundColor Yellow
scp $PACKAGE_NAME "$($USER)@$($SERVER_IP):$TARGET_DIR"

# 5. Ejecutar comandos remotos por SSH
Write-Host "⚡ Ejecutando comandos de actualización en Hostinger..." -ForegroundColor Yellow
# Probamos primero con 'docker compose' y luego con 'docker-compose' por si acaso
$REMOTE_CMD = "cd $TARGET_DIR && tar -xzf $PACKAGE_NAME && (docker compose -f docker-compose.yml.hostinger down; docker compose -f docker-compose.yml.hostinger up -d --build) && rm $PACKAGE_NAME"
ssh "$($USER)@$($SERVER_IP)" "$REMOTE_CMD"

Write-Host "`n✅ ¡DESPLIEGUE COMPLETADO CON ÉXITO! El sistema ya está actualizado.`n" -ForegroundColor Green
