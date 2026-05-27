# PowerShell Automated Deployment Script for Print-Scan WebUI Container
# Antigravity AI Assistant - Premium & Beautiful CLI Output

$ErrorActionPreference = "Stop"

$PI_USER = $env:PI_USER
$PI_HOST = $env:PI_HOST
if (-not $PI_USER) { $PI_USER = "pi" }
if (-not $PI_HOST) { $PI_HOST = "192.168.0.10" }


Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    STARTING AUTOMATED CONTAINER BUILD & DEPLOYMENT" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Build the Next.js application locally for maximum performance
Write-Host "--> [1/5] Building Next.js project locally..." -ForegroundColor Blue
bun run build

# 2. Build the Docker image locally for ARM64 (Raspberry Pi 64-bit architecture) using pre-built files
Write-Host "--> [2/5] Building Docker image for linux/arm64..." -ForegroundColor Blue
docker buildx build --platform linux/arm64 -t print-scan-webui:latest --load .

# 3. Save the image to a tarball
Write-Host "--> [3/5] Saving Docker image to print-scan-webui.tar..." -ForegroundColor Blue
if (Test-Path "print-scan-webui.tar") {
    Remove-Item "print-scan-webui.tar"
}
docker save print-scan-webui:latest -o print-scan-webui.tar

# 4. Transfer the image to the Raspberry Pi
Write-Host "--> [4/5] Transferring image tarball to Raspberry Pi via scp..." -ForegroundColor Blue
scp print-scan-webui.tar ${PI_USER}@${PI_HOST}:/home/pi/print-scan-webui.tar
Remove-Item "print-scan-webui.tar"

# 5. Stop native service, load image and start the container on the Pi
Write-Host "--> [5/5] Activating container on the Raspberry Pi..." -ForegroundColor Blue
ssh ${PI_USER}@${PI_HOST} "
  echo 'Ensuring ipp-usb daemon is running on host...' && \
  sudo systemctl enable ipp-usb || true && \
  sudo systemctl start ipp-usb || true && \
  \
  echo 'Stopping and disabling native host systemd service...' && \
  sudo systemctl stop print-scan-server.service || true && \
  sudo systemctl disable print-scan-server.service || true && \
  \
  echo 'Loading container image...' && \
  sudo docker load -i /home/pi/print-scan-webui.tar && \
  rm /home/pi/print-scan-webui.tar && \
  \
  echo 'Stopping existing container...' && \
  sudo docker stop print-scan-webui || true && \
  sudo docker rm print-scan-webui || true && \
  \
  echo 'Launching new container with system privileges...' && \
  sudo docker run -d \
    --name print-scan-webui \
    --network host \
    --privileged \
    --pid host \
    -v /var/run/cups/cups.sock:/var/run/cups/cups.sock \
    -v /dev/bus/usb:/dev/bus/usb \
    -v /home/pi/production/dcp-t220-print-scan-webui/usb-power.json:/app/usb-power.json \
    --restart unless-stopped \
    print-scan-webui:latest && \
  echo 'Container print-scan-webui started successfully!'

"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      SUCCESS: DEPLOYMENT PROCEDURE COMPLETED!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "The Next.js WebUI is now running inside Docker!"
Write-Host "Web UI: http://${PI_HOST}:8080"
Write-Host "==========================================================" -ForegroundColor Green
