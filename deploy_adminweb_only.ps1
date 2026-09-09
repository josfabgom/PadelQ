# --- SCRIPT DE DESPLIEGUE RÁPIDO DE ADMINWEB PARA HOSTINGER (PADELQ) ---
# Autor: Antigravity AI
# Uso: .\deploy_adminweb_only.ps1
# SEGURO: Solo reconstruye el contenedor admin_web. No toca padelq_api ni la base de datos.

$SERVER_IP = "31.97.19.119"
$USER = "root"
$TARGET_DIR = "/var/www/padelq"
$PACKAGE_NAME = "padelq_adminweb_patch.tar.gz"
$SSH_KEY = "C:\Users\josfa\.ssh\id_ed25519_padelq"

Write-Host "
🚀 Iniciando despliegue de solo-AdminWeb en Hostinger...
" -ForegroundColor Cyan

# 1. Compilar el frontend localmente
Write-Host "📦 Compilando AdminWeb para producción..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\PadelQ.AdminWeb"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Falló la compilación de Admin Web"; Set-Location $PSScriptRoot; exit 1 }
Set-Location $PSScriptRoot

# 2. Empaquetar solo AdminWeb y docker-compose
Write-Host "🗜️  Empaquetando archivos para transferencia..." -ForegroundColor Yellow
tar -czf $PACKAGE_NAME --exclude="node_modules" --exclude="dist" PadelQ.AdminWeb docker-compose.yml.hostinger
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el empaquetado"; exit 1 }

# 3. Subir al servidor
Write-Host "📤 Subiendo paquete a $USER@$SERVER_IP..." -ForegroundColor Yellow
scp -i $SSH_KEY $PACKAGE_NAME "$($USER)@$($SERVER_IP):$TARGET_DIR"
if ($LASTEXITCODE -ne 0) { Write-Error "Falló la transferencia SCP"; exit 1 }

# 4. Reconstruir SOLO admin_web en el servidor
Write-Host "⚡ Reconstruyendo solo admin_web en Hostinger..." -ForegroundColor Yellow
$REMOTE_CMD = "cd $TARGET_DIR && tar -xzf $PACKAGE_NAME && docker compose -f docker-compose.yml.hostinger build admin_web && docker compose -f docker-compose.yml.hostinger up -d admin_web && docker image prune -af && docker builder prune -f && rm $PACKAGE_NAME"
ssh -i $SSH_KEY "$($USER)@$($SERVER_IP)" "$REMOTE_CMD"
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el despliegue remoto"; exit 1 }

# 5. Limpiar local
if (Test-Path $PACKAGE_NAME) { Remove-Item $PACKAGE_NAME -Force }

Write-Host "
✅ ¡DESPLIEGUE DE ADMINWEB COMPLETADO! Solo admin_web fue actualizado." -ForegroundColor Green
Write-Host "   API:            sin cambios ✔" -ForegroundColor DarkGray
Write-Host "   Base de datos:  sin cambios ✔
" -ForegroundColor DarkGray
