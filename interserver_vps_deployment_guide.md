# 🖥️ InterServer VPS Deployment Guide for WhatsApp API Service

Deploying `whatsapp-web.js` on an **InterServer VPS** is the absolute best way to run this application! Because you have full root (`sudo`) access, we can configure headless Chrome/Chromium to run locally on your virtual server, ensuring maximum performance, zero latency, and complete privacy.

This step-by-step guide assumes your InterServer VPS is running **Ubuntu** (20.04, 22.04, or 24.04 LTS), which is the standard OS for VPS deployments.

---

## 📋 Table of Contents
1. [Step 1: Connect to your InterServer VPS](#step-1-connect-to-your-interserver-vps)
2. [Step 2: Install Node.js, Git, and PM2](#step-2-install-nodejs-git-and-pm2)
3. [Step 3: Install Required Chrome OS Libraries](#step-3-install-required-chrome-os-libraries)
4. [Step 4: Clone and Setup the Project](#step-4-clone-and-setup-the-project)
5. [Step 5: Setup Environment Variables](#step-5-setup-environment-variables)
6. [Step 6: Start and Manage the Service with PM2](#step-6-start-and-manage-the-service-with-pm2)
7. [📁 Session Persistence & File Permissions](#-session-persistence--file-permissions)

---

## Step 1: Connect to your InterServer VPS

Open your terminal (or PowerShell on Windows) and log into your InterServer VPS using the IP and root credentials provided in your InterServer dashboard:
```bash
ssh root@YOUR_VPS_IP_ADDRESS
```
*(Enter your root password when prompted)*

---

## Step 2: Install Node.js, Git, and PM2

Ensure your OS packages are up to date, then install Node.js (Version 20) and PM2 (which keeps your API running forever):

```bash
# 1. Update OS packages
sudo apt update && sudo apt upgrade -y

# 2. Add NodeSource repository for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 3. Install Node.js and Git
sudo apt-get install -y nodejs git

# 4. Install PM2 globally
sudo npm install -g pm2
```

---

## Step 3: Install Required Chrome OS Libraries

Headless Chrome requires certain low-level system graphics and audio libraries to launch successfully in a Linux command-line environment. Run the following command to install all of them:

```bash
sudo apt-get install -y \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgbm-dev \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0
```

---

## Step 4: Clone and Setup the Project

Navigate to your web directory, clone your project, and install dependencies:

```bash
# 1. Clone your repository directly into the home directory as 'whatappapi'
git clone <YOUR_GIT_REPOSITORY_URL> /home/whatappapi
cd /home/whatappapi

# 3. Install NPM dependencies
npm install

# 4. Install Puppeteer's Chrome binary for Linux
npx puppeteer browsers install chrome
```

---

## Step 5: Setup Environment Variables

Create your production `.env` configuration file:

```bash
nano .env
```

Paste in the following configurations (adjust the Port if you'd like it to run on a different port):
```env
PORT=3000
NODE_ENV=production
```
*Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit the nano editor.*

---

## Step 6: Start and Manage the Service with PM2

PM2 ensures the server will auto-restart if the server crashes or restarts:

```bash
# 1. Start the API under PM2
pm2 start app.js --name "whatsapp-api"

# 2. Configure PM2 to start automatically on system boot
pm2 startup

# 3. Save the current process list
pm2 save
```

### 🛠️ Useful PM2 Commands:
* **View live logs:** `pm2 logs whatsapp-api`
* **Restart the server:** `pm2 restart whatsapp-api`
* **Check system metrics (CPU/RAM):** `pm2 monit`
* **Stop the server:** `pm2 stop whatsapp-api`

---

## 📁 Session Persistence & File Permissions

The WhatsApp session client uses a local folder (`sessions/`) to save authentication data (so you don't have to scan the QR code again). Ensure the directory has correct write permissions on Linux:

```bash
sudo chmod -R 775 /home/whatappapi/sessions
```
*(If the directory doesn't exist yet, the API will create it automatically, but running this command ensures Node has the permissions to write inside it.)*
