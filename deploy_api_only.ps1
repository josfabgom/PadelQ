# --- SCRIPT DE DESPLIEGUE RÁPIDO DE API PARA HOSTINGER (PADELQ) ---
# Autor: Antigravity AI
# Uso: .\deploy_api_only.ps1

$SERVER_IP = "31.97.19.119"
$USER = "root"
$TARGET_DIR = "/var/www/padelq"
$PACKAGE_NAME = "padelq_api_patch.tar.gz"

Write-Host "`n🚀 Iniciando despliegue de solo-API en Hostinger...`n" -ForegroundColor Cyan

# 1. Empaquetar solo lo necesario
Write-Host "🗜️ Empaquetando archivos backend para transferencia..." -ForegroundColor Yellow
$FILES_TO_PACK = "PadelQ.Api", "PadelQ.Application", "PadelQ.Domain", "PadelQ.Infrastructure", "docker-compose.yml.hostinger"
tar -czf $PACKAGE_NAME --exclude="bin" --exclude="obj" $FILES_TO_PACK

# 2. Subir el paquete al servidor
Write-Host "📤 Subiendo paquete a $USER@$SERVER_IP..." -ForegroundColor Yellow
$SSH_KEY = "C:\Users\josfa\.ssh\id_ed25519_padelq"
scp -i $SSH_KEY $PACKAGE_NAME "$($USER)@$($SERVER_IP):$TARGET_DIR"

# 3. Ejecutar comandos remotos por SSH
Write-Host "⚡ Ejecutando actualización de padelq_api en Hostinger..." -ForegroundColor Yellow
$REMOTE_CMD = "cd $TARGET_DIR && tar -xzf $PACKAGE_NAME && docker compose -f docker-compose.yml.hostinger build padelq_api && docker compose -f docker-compose.yml.hostinger up -d padelq_api && docker image prune -af && docker builder prune -f && rm $PACKAGE_NAME"
ssh -i $SSH_KEY "$($USER)@$($SERVER_IP)" "$REMOTE_CMD"

# 4. Limpiar local
if (Test-Path $PACKAGE_NAME) { Remove-Item $PACKAGE_NAME -Force }

Write-Host "`n✅ ¡DESPLIEGUE DE API COMPLETADO CON ÉXITO!`n" -ForegroundColor Green
