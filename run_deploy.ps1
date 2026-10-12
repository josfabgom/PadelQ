$SERVER_IP = "31.97.19.119"
$USER = "root"
$TARGET_DIR = "/var/www/padelq"
$PACKAGE_NAME = "padelq_deploy.tar.gz"

$rawFlutterPath = "$PSScriptRoot\sdks\flutter\bin\flutter.bat"
$fso = New-Object -ComObject Scripting.FileSystemObject
$shortPath = $fso.GetFile($rawFlutterPath).ShortPath
$FLUTTER_EXE = $shortPath

$BUILD_ROOT = $PSScriptRoot
if ($PSScriptRoot -like "* *") {
    $JUNCTION_PATH = "D:\PadelQ_Build"
    if (!(Test-Path $JUNCTION_PATH)) {
        New-Item -ItemType Junction -Path $JUNCTION_PATH -Value $PSScriptRoot
    }
    $BUILD_ROOT = $JUNCTION_PATH
}

Set-Location "$BUILD_ROOT\PadelQ.MobileApp"
& $FLUTTER_EXE build web --release --dart-define=API_URL=https://api.blackclubdepadel.com.ar

Set-Location $PSScriptRoot
cd PadelQ.AdminWeb
npm run build
cd ..

if (Test-Path ".\dist") { Remove-Item -Path ".\dist" -Recurse -Force }
Move-Item -Path ".\PadelQ.AdminWeb\dist" -Destination ".\dist" -Force

if (Test-Path ".\build\web") { Remove-Item -Path ".\build\web" -Recurse -Force }
if (Test-Path ".\PadelQ.MobileApp\build\web") {
    if (!(Test-Path ".\build")) { New-Item -ItemType Directory -Path ".\build" }
    Copy-Item -Path ".\PadelQ.MobileApp\build\web" -Destination ".\build\web" -Recurse -Force
}

$FILES_TO_PACK = "PadelQ.Api", "PadelQ.Application", "PadelQ.Domain", "PadelQ.Infrastructure", "PadelQ.AdminWeb", "dist", "build", ".env", "docker-compose.yml.hostinger", "nginx.conf", "frontend.nginx.conf"
tar -czf $PACKAGE_NAME --exclude="bin" --exclude="obj" --exclude="node_modules" $FILES_TO_PACK

$SSH_KEY = "C:\Users\SoporteQ\.ssh\id_ed25519"
scp -o StrictHostKeyChecking=no -i $SSH_KEY $PACKAGE_NAME "$($USER)@$($SERVER_IP):$TARGET_DIR"

$REMOTE_CMD = "cd $TARGET_DIR && tar -xzf $PACKAGE_NAME && docker compose -f docker-compose.yml.hostinger up -d --build && docker image prune -af && docker builder prune -f && rm $PACKAGE_NAME"
ssh -o StrictHostKeyChecking=no -i $SSH_KEY "$($USER)@$($SERVER_IP)" "$REMOTE_CMD"
