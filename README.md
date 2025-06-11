# DCP-T220 Print Scan WebUI

This project provides a complete solution for managing Brother DCP-T220 printer operations through a modern web interface. The system creates a standalone WiFi hotspot that automatically redirects users to the printer management interface, making it perfect for environments where network infrastructure is limited.

### Key Features

- **Web-based Print & Scan Interface**: Modern Next.js 15.3.3 frontend
- **Standalone WiFi Hotspot**: No external network required
- **Captive Portal**: Automatic redirection to printer interface
- **Multi-device Support**: Works with smartphones, tablets, and computers
- **Real-time Status**: Live printer status monitoring
- **Document Processing**: Print as Document and Photo (Glossy), Scan as a multiple file as confined PDF or image zip download
- **Maintenance**: One click Head cleaning

### Web-UI Features

- **Document & Photo Printing** - Upload and print PDFs, JPG, PNG, GIF, BMP files with drag & drop support
- **Advanced Print Settings** - Configure paper size (A4, A5, Letter, Legal, Photo sizes), quality (Draft/Normal/High), and color modes
- **Multi-Format Document Scanning** - Scan documents to PDF, JPEG, or PNG with color/grayscale/B&W options
- **Multi-Page Scanning** - Scan multiple pages into a single PDF document with page preview and management
- **Print Head Maintenance** - Automated cleaning cycles with selectable intensity and ink usage tracking
- **Real-Time Status Monitoring** - Live printer status updates, connection monitoring, and uptime tracking
- **Ink Level Management** - Individual cartridge monitoring (Black, Cyan, Magenta, Yellow) with low ink alerts
- **Job Queue Management** - Monitor active and pending print jobs with queue status
- **Paper Status Tracking** - Current paper size detection and loading status
- **Sleep Mode Control** - Printer power management and wake-up functionality
- **Mobile-Responsive Design** - Clean, modern interface optimized for desktop and mobile devices
- **Quick Action Dashboard** - Centralized access to all printer functions with visual status indicators

## Screenshots

| ![Screenshot 1](/screenshots/1.jpeg) | ![Screenshot 2](/screenshots/2.jpeg) | ![Screenshot 3](/screenshots/3.jpeg) |
|--------------------------------------|--------------------------------------|--------------------------------------|
| ![Screenshot 4](/screenshots/4.jpeg) | ![Screenshot 5](/screenshots/5.jpeg) | ![Screenshot 6](/screenshots/6.jpeg) |


## 🛠️ Hardware Requirements

- **Host Device**: Raspberry Pi 3 Model B (or newer)
- **Printer**: Brother DCP-T220

## 📋 Software Stack

- **OS**: Debian GNU/Linux 12 (bookworm) aarch64
- **Web Framework**: Next.js 15.3.3
- **Runtime**: Node.js v24.1.0
- **Print System**: CUPS (Common Unix Printing System)
- **Web Server**: Nginx (for captive portal)
- **WiFi Management**: hostapd, dnsmasq
- **Required Tools**: lpstat, lp, gs (Ghostscript), convert (ImageMagick), pdftoppm, scanimage

## 🚀 Installation Guide

### Prerequisites

1. **Fresh Raspberry Pi OS Installation**
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Node.js via NVM** (recommended for version management)
   ```bash
   # Download and install nvm:
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   
   # in lieu of restarting the shell
   \. "$HOME/.nvm/nvm.sh"
   
   # Download and install Node.js:
   nvm install 24
   
   nvm use 24.1.0
   nvm alias default 24.1.0
   ```

### Step 1: CUPS Print System Setup

```bash
# Install CUPS
sudo apt update
sudo apt install cups -y

# Add pi user to lpadmin group
sudo usermod -a -G lpadmin pi

# Configure CUPS for remote access
sudo cupsctl --remote-any

# Restart CUPS service
sudo systemctl restart cups

# Add Brother DCP-T220 printer (192.168.0.10 -> replace IP if using network connection)
sudo lpadmin -p print -E -v ipp://192.168.0.10:60000/ipp/print -m everywhere
```

### Step 2: Install Required System Tools

```bash
# Install printing and scanning utilities
sudo apt install -y \
    ghostscript \
    imagemagick \
    poppler-utils \
    sane-utils \
    iptables-persistent \
    nginx \
    hostapd \
    dnsmasq
```

### Step 3: Clone and Setup Project

```bash
# Create production directory (replace your username if different pi)
mkdir -p /home/pi/production

# Clone the project (replace with your repository URL)
cd /home/pi/production
git clone https://github.com/biplobsd/dcp-t220-print-scan-webui.git

# Navigate to project directory
cd dcp-t220-print-scan-webui

# Install project dependencies
npm install

# Build the project
npm run build
```

### Step 4: Configure WiFi Hotspot

#### 4.1 Configure hostapd

```bash
sudo tee /etc/hostapd/hostapd.conf > /dev/null <<EOF
interface=wlan0
driver=nl80211
ssid=Printer
hw_mode=g
channel=7
wmm_enabled=0
country_code=BD
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=12345678
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF
```

#### 4.2 Configure DHCP (dnsmasq)

```bash
sudo tee /etc/dnsmasq.conf > /dev/null <<EOF
interface=wlan0
dhcp-range=192.168.50.2,192.168.50.20,255.255.255.0,24h

# Add these lines for captive portal functionality
dhcp-option=3,192.168.50.1
dhcp-option=6,192.168.50.1
address=/#/192.168.50.1
EOF
```

#### 4.3 Configure Static IP (dhcpcd)

```bash
# Backup original configuration
sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup

# Add WiFi hotspot configuration
sudo tee -a /etc/dhcpcd.conf > /dev/null <<EOF

# WiFi Hotspot Configuration
interface wlan0
static ip_address=192.168.50.1/24
static domain_name_servers=1.1.1.1 8.8.8.8
nohook wpa_supplicant
EOF
```

### Step 5: Configure Captive Portal

#### 5.1 Create Loading Page Directory

```bash
sudo mkdir -p /var/www/loading
```

#### 5.2 Create Loading Page

```bash
sudo tee /var/www/loading/index.html > /dev/null <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading Printer Portal...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            text-align: center;
            padding: 20px;
            max-width: 600px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            margin-bottom: 20px;
        }
        .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .status {
            margin-top: 20px;
            font-style: italic;
        }
        .retry-button {
            margin-top: 20px;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: none;
        }
        .retry-button:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Printer Portal is Starting</h1>
        <div class="loader"></div>
        <p>Please wait while the printer service is initializing...</p>
        <p class="status" id="status">Checking service status...</p>
        <button class="retry-button" id="retryButton">Try Now</button>
    </div>

    <script>
        const maxAttempts = 60; // Maximum number of attempts (60 seconds)
        let attempts = 0;
        const statusElement = document.getElementById('status');
        const retryButton = document.getElementById('retryButton');

        function checkService() {
            attempts++;
            statusElement.textContent = `Checking service status... (Attempt ${attempts}/${maxAttempts})`;

            // Using fetch with a timeout to check if the service is available
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            fetch('http://192.168.50.1:8080', {
                mode: 'no-cors',
                signal: controller.signal
            })
            .then(() => {
                // Service is available, redirect
                statusElement.textContent = 'Printer service is ready! Redirecting...';
                setTimeout(() => {
                    window.location.href = 'http://192.168.50.1:8080';
                }, 1000);
            })
            .catch(() => {
                clearTimeout(timeoutId);
                if (attempts < maxAttempts) {
                    // Try again after 1 second
                    setTimeout(checkService, 1000);
                } else {
                    // Max attempts reached, show retry button
                    statusElement.textContent = 'Service is taking longer than expected to start.';
                    retryButton.style.display = 'inline-block';
                    retryButton.addEventListener('click', () => {
                        attempts = 0;
                        retryButton.style.display = 'none';
                        checkService();
                    });
                }
            });
        }

        // Start checking as soon as page loads
        window.onload = checkService;
    </script>
</body>
</html>
EOF
```

#### 5.3 Configure Nginx for Captive Portal

```bash
sudo tee /etc/nginx/sites-available/captive-portal > /dev/null <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    # Serve the loading page for direct access to the server
    location / {
        root /var/www/loading;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Handle captive portal detection for Apple devices
    location /hotspot-detect.html {
        root /var/www/loading;
        try_files /index.html =200;
    }

    # Handle captive portal detection for Android devices
    location /generate_204 {
        root /var/www/loading;
        try_files /index.html =200;
    }

    # Handle Microsoft's NCSI
    location /ncsi.txt {
        return 200 "Microsoft NCSI";
        add_header Content-Type text/plain;
    }

    # Handle general captive portal detection
    location /success.txt {
        return 200 "success";
        add_header Content-Type text/plain;
    }

    # Proxy requests to the actual server for health checks
    location /check-service {
        proxy_pass http://192.168.50.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_intercept_errors on;
        error_page 502 503 504 = @loading;
    }

    location @loading {
        root /var/www/loading;
        try_files /index.html =200;
    }
}
EOF

# Enable the site
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/captive-portal /etc/nginx/sites-enabled/
```

### Step 6: Configure IP Forwarding and Firewall

```bash
# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Configure iptables for traffic redirection
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 80 -j DNAT --to-destination 192.168.50.1:80
sudo iptables -t nat -A POSTROUTING -j MASQUERADE

# Save iptables rules
sudo netfilter-persistent save
```

### Step 7: Create Systemd Service

```bash
sudo tee /etc/systemd/system/dcp-t220-print-scan-webui.service > /dev/null <<EOF
[Unit]
Description=DCP-T220 Print Scan WebUI
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/production/dcp-t220-print-scan-webui
ExecStart=/home/pi/.nvm/versions/node/v24.1.0/bin/npm start
Environment=PATH=/home/pi/.nvm/versions/node/v24.1.0/bin:/usr/bin:/bin
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=dcp-t220-print-scan-webui

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable the service
sudo systemctl daemon-reload
sudo systemctl enable dcp-t220-print-scan-webui
```

### Step 8: Enable and Start Services

```bash
# Enable and start hostapd
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl start hostapd

# Enable and start dnsmasq
sudo systemctl enable dnsmasq
sudo systemctl restart dnsmasq

# Enable and start nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

# Enable and start the print-scan service
sudo systemctl enable dcp-t220-print-scan-webui
sudo systemctl start dcp-t220-print-scan-webui
```

### Step 9: Final System Reboot

```bash
# Reboot to apply all changes
sudo reboot
```

## 📱 Usage Instructions

### Connecting to the Printer

1. **Connect to WiFi Hotspot**
    - SSID: `Printer`
    - Password: `12345678`

2. **Automatic Redirection**
    - Most devices will automatically open the captive portal
    - If not, open a web browser and navigate to any website

3. **Access Web Interface**
    - The system will automatically redirect to `http://192.168.50.1:8080`
    - Wait for the service to fully start (up to 60 seconds)

## 🔒 Security Considerations

- The WiFi hotspot uses WPA2 encryption with the password `12345678`
- Change the default password in `/etc/hostapd/hostapd.conf` for production use
- The system is designed for local network use only
- No internet access is provided through the hotspot

## 🔄 Updates

### Updating the Application

```bash
cd /home/pi/production/dcp-t220-print-scan-webui
git pull origin main
npm install
npm run build
sudo systemctl restart dcp-t220-print-scan-webui
```