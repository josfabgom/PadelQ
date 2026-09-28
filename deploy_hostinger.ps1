# --- SCRIPT DE DESPLIEGUE AUTOMTICO PARA HOSTINGER (PADELQ) ---
# Autor: Antigravity AI
# Uso: .\deploy_hostinger.ps1

$SERVER_IP = "31.97.19.119"
$USER = "root"
$TARGET_DIR = "/var/www/padelq"
$PACKAGE_NAME = "padelq_deploy.tar.gz"

# Resolver la ruta de Flutter de forma segura
$rawFlutterPath = "$PSScriptRoot\sdks\flutter\bin\flutter.bat"
if (Test-Path $rawFlutterPath) {
    $fso = New-Object -ComObject Scripting.FileSystemObject
    $shortPath = $fso.GetFile($rawFlutterPath).ShortPath
    $FLUTTER_EXE = $shortPath
    Set-Location "$PSScriptRoot\PadelQ.MobileApp"
    Write-Host " Compilando App Movil para produccion..." -ForegroundColor Yellow
    & $FLUTTER_EXE build web --release --dart-define=API_URL=https://api.blackclubdepadel.com.ar
    if ($LASTEXITCODE -ne 0) { Write-Error "Fallo la compilacion de la App Movil"; Set-Location $PSScriptRoot; exit }
} else {
    Write-Host " Flutter no encontrado. Omitiendo compilacion movil." -ForegroundColor Yellow
}

# Volver a la ruta original para el resto (Vite prefiere la ruta real)
Set-Location $PSScriptRoot

# 2. Compilar Admin Web
Write-Host " Compilando Admin Web para produccion (Ruta Real)..." -ForegroundColor Yellow
cd PadelQ.AdminWeb
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo la compilacion de Admin Web"; exit }
cd ..

# 2. Asegurar que las carpetas de compilacion estn en la raiz para Docker
if (Test-Path ".\dist") { Remove-Item -Path ".\dist" -Recurse -Force }
Move-Item -Path ".\PadelQ.AdminWeb\dist" -Destination ".\dist" -Force

if (Test-Path ".\build\web") { Remove-Item -Path ".\build\web" -Recurse -Force }
if (Test-Path ".\PadelQ.MobileApp\build\web") {
    if (!(Test-Path ".\build")) { New-Item -ItemType Directory -Path ".\build" }
    Copy-Item -Path ".\PadelQ.MobileApp\build\web" -Destination ".\build\web" -Recurse -Force
}

# 3. Empaquetar solo lo necesario (Selectivo)
Write-Host " Empaquetando archivos para transferencia (Modo Selectivo)..." -ForegroundColor Yellow
# Definimos los componentes criticos para produccion (Incluyendo 'build' para la app movil)
$FILES_TO_PACK = "PadelQ.Api", "PadelQ.Application", "PadelQ.Domain", "PadelQ.Infrastructure", "PadelQ.AdminWeb", "dist", "build", ".env", "docker-compose.yml.hostinger", "nginx.conf", "frontend.nginx.conf"
tar -czf $PACKAGE_NAME --exclude="bin" --exclude="obj" --exclude="node_modules" $FILES_TO_PACK

# 4. Subir el paquete al servidor
Write-Host " Subiendo paquete a $USER@$SERVER_IP..." -ForegroundColor Yellow
$SSH_KEY = "C:\AntiGravity Proyectos\PadelQ\temp_key_deploy"
scp -o StrictHostKeyChecking=no -i $SSH_KEY $PACKAGE_NAME "$($USER)@$($SERVER_IP):$TARGET_DIR"

# 5. Ejecutar comandos remotos por SSH
Write-Host " Ejecutando comandos de actualizacion y limpieza en Hostinger..." -ForegroundColor Yellow
$REMOTE_CMD = "cd $TARGET_DIR && tar -xzf $PACKAGE_NAME && docker compose -f docker-compose.yml.hostinger up -d --build && docker image prune -af && docker builder prune -f && rm $PACKAGE_NAME"
ssh -o StrictHostKeyChecking=no -i $SSH_KEY "$($USER)@$($SERVER_IP)" "$REMOTE_CMD"

Write-Host "`n DESPLIEGUE COMPLETADO CON EXITO! El sistema ya esta actualizado.`n" -ForegroundColor Green

