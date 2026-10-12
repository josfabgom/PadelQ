# --- SCRIPT DE DESPLIEGUE AUTOMÃTICO PARA HOSTINGER (PADELQ) ---
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
    Write-Host "ðŸ”— Usando puente virtual sin espacios: $BUILD_ROOT" -ForegroundColor Gray
}

Write-Host "`nðŸš€ Iniciando despliegue automÃ¡tico en Hostinger (Modo HÃ­brido)...`n" -ForegroundColor Cyan

# 1. Compilar App MÃ³vil (Flutter) - Necesita ruta sin espacios
#Write-Host "ðŸ“± Ejecutando code generation (build_runner)..." -ForegroundColor Yellow
Set-Location "$BUILD_ROOT\PadelQ.MobileApp"

Write-Host "ðŸ“± Compilando App MÃ³vil para producciÃ³n (Usando puente)..." -ForegroundColor Yellow
& $FLUTTER_EXE build web --release --dart-define=API_URL=https://api.blackclubdepadel.com.ar
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo la compilaciÃ³n de la App MÃ³vil"; Set-Location $PSScriptRoot; exit }

# Volver a la ruta original para el resto (Vite prefiere la ruta real)
Set-Location $PSScriptRoot

# 2. Compilar Admin Web
Write-Host "ðŸ“¦ Compilando Admin Web para producciÃ³n (Ruta Real)..." -ForegroundColor Yellow
cd PadelQ.AdminWeb
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo la compilaciÃ³n de Admin Web"; exit }
cd ..

# 2. Asegurar que las carpetas de compilaciÃ³n estÃ©n en la raÃ­z para Docker
if (Test-Path ".\dist") { Remove-Item -Path ".\dist" -Recurse -Force }
Move-Item -Path ".\PadelQ.AdminWeb\dist" -Destination ".\dist" -Force

if (Test-Path ".\build\web") { Remove-Item -Path ".\build\web" -Recurse -Force }
if (Test-Path ".\PadelQ.MobileApp\build\web") {
    if (!(Test-Path ".\build")) { New-Item -ItemType Directory -Path ".\build" }
    Copy-Item -Path ".\PadelQ.MobileApp\build\web" -Destination ".\build\web" -Recurse -Force
}

# 3. Empaquetar solo lo necesario (Selectivo)
Write-Host "ðŸ—œï¸ Empaquetando archivos para transferencia (Modo Selectivo)..." -ForegroundColor Yellow
# Definimos los componentes crÃ­ticos para producciÃ³n (Incluyendo 'build' para la app mÃ³vil)
$FILES_TO_PACK = "PadelQ.Api", "PadelQ.Application", "PadelQ.Domain", "PadelQ.Infrastructure", "PadelQ.AdminWeb", "dist", "build", ".env", "docker-compose.yml.hostinger", "nginx.conf", "frontend.nginx.conf"
tar -czf $PACKAGE_NAME --exclude="bin" --exclude="obj" --exclude="node_modules" $FILES_TO_PACK

# 4. Subir el paquete al servidor
Write-Host "ðŸ“¤ Subiendo paquete a $USER@$SERVER_IP..." -ForegroundColor Yellow
$SSH_KEY = "C:\Users\SoporteQ\.ssh\id_ed25519"
scp -i $SSH_KEY $PACKAGE_NAME "$($USER)@$($SERVER_IP):$TARGET_DIR"

# 5. Ejecutar comandos remotos por SSH
Write-Host "âš¡ Ejecutando comandos de actualizaciÃ³n y limpieza en Hostinger..." -ForegroundColor Yellow
$REMOTE_CMD = "cd $TARGET_DIR && tar -xzf $PACKAGE_NAME && docker compose -f docker-compose.yml.hostinger up -d --build && docker image prune -af && docker builder prune -f && rm $PACKAGE_NAME"
ssh -i $SSH_KEY "$($USER)@$($SERVER_IP)" "$REMOTE_CMD"

Write-Host "`nâœ… Â¡DESPLIEGUE COMPLETADO CON Ã‰XITO! El sistema ya estÃ¡ actualizado.`n" -ForegroundColor Green
