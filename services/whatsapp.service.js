const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.clients = {};
        this.sessionStates = {};
    }

    async initSession(libraryId) {
        if (this.clients[libraryId]) {
            const localState = this.sessionStates[libraryId] || {};
            const inactiveStates = ['FAILED', 'DISCONNECTED', 'AUTH_FAILURE'];

            // If session is already in an active state, do not spawn a new one!
            if (localState.status && !inactiveStates.includes(localState.status)) {
                console.log(`[${libraryId}] Session is already active in state: ${localState.status}. Skipping initialization.`);
                return { status: localState.status, qrCode: localState.qr, message: `Session is already active in state: ${localState.status}` };
            }

            // If it exists but is inactive/failed, cleanly destroy the old Puppeteer instance to release file locks!
            try {
                console.log(`[${libraryId}] Destroying inactive/failed client instance to release Chrome locks...`);
                await this.clients[libraryId].destroy();
            } catch (err) {
                console.warn(`[${libraryId}] Warning during old client destruction:`, err.message);
            }
            delete this.clients[libraryId];
        }

        console.log(`[${libraryId}] Initializing WhatsApp Session...`);
        this.sessionStates[libraryId] = { status: 'INITIALIZING', qr: null };

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: libraryId,
                dataPath: path.join(__dirname, '../sessions'),
                // On Windows, Chrome holds the lockfile briefly after disconnect.
                // Retrying up to 10 times (with built-in 100ms back-off each) prevents
                // the EBUSY crash when LocalAuth tries to rm the session directory.
                rmMaxRetries: 10
            }),
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
                strict: false
            },
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                ],
            }
        });

        // Setup a Promise that will resolve as soon as either a QR Code is received or the client is ready
        const waitForInit = new Promise((resolve, reject) => {
            let resolved = false;

            const handleQr = async (qr) => {
                if (resolved) return;
                resolved = true;
                cleanUpListeners();
                try {
                    const qrImageBase64 = await QRCode.toDataURL(qr);
                    resolve({ status: 'QR_RECEIVED', qrCode: qrImageBase64, message: 'Scan the QR code to connect' });
                } catch (err) {
                    reject(err);
                }
            };

            const handleReady = () => {
                if (resolved) return;
                resolved = true;
                cleanUpListeners();
                resolve({ status: 'CONNECTED', qrCode: null, message: 'WhatsApp is connected and ready!' });
            };

            const handleFailure = (err) => {
                if (resolved) return;
                resolved = true;
                cleanUpListeners();
                reject(err);
            };

            client.once('qr', handleQr);
            client.once('ready', handleReady);
            client.once('auth_failure', (msg) => handleFailure(new Error('Authentication failure: ' + msg)));
            client.once('disconnected', (reason) => handleFailure(new Error('Disconnected: ' + reason)));

            const cleanUpListeners = () => {
                client.off('qr', handleQr);
                client.off('ready', handleReady);
            };

            // Set a timeout of 20 seconds in case it hangs or network is slow
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanUpListeners();
                    // Fall back to returning INITIALIZING so they can poll status
                    resolve({ status: 'INITIALIZING', qrCode: null, message: 'Session started. Please poll status endpoint for QR code.' });
                }
            }, 20000);
        });

        client.on('qr', async (qr) => {
            console.log(`[${libraryId}] Scan this QR Code (also generated for UI):`);
            qrcode.generate(qr, { small: true });

            try {
                const qrImageBase64 = await QRCode.toDataURL(qr);
                this.sessionStates[libraryId] = { status: 'QR_RECEIVED', qr: qrImageBase64 };
            } catch (err) {
                console.error(`[${libraryId}] Failed to generate base64 QR:`, err.message);
            }
        });

        client.on('ready', () => {
            console.log(`[${libraryId}] WhatsApp Client is READY!`);
            this.sessionStates[libraryId] = { status: 'CONNECTED', qr: null };
        });

        client.on('authenticated', () => {
            console.log(`[${libraryId}] Authenticated successfully.`);
            this.sessionStates[libraryId] = { status: 'AUTHENTICATED', qr: null };
        });

        client.on('auth_failure', (msg) => {
            console.error(`[${libraryId}] Authentication failure:`, msg);
            this.sessionStates[libraryId] = { status: 'AUTH_FAILURE', qr: null };
        });

        client.on('disconnected', async (reason) => {
            console.log(`[${libraryId}] Client was logged out:`, reason);
            this.sessionStates[libraryId] = { status: 'DISCONNECTED', qr: null };
            delete this.clients[libraryId];

            // CRITICAL (Windows fix): Destroy the Puppeteer browser BEFORE LocalAuth's
            // logout cleanup runs. Chrome holds an exclusive lock on the 'lockfile'
            // inside the session directory. If we don't close Chrome first, the
            // fs.promises.rm() call inside LocalAuth.logout() throws EBUSY and
            // crashes the entire Node process.
            try {
                await client.destroy();
            } catch (destroyErr) {
                // Ignore — browser may already be closed (e.g. crash scenario)
                console.warn(`[${libraryId}] Browser destroy after disconnect (non-fatal):`, destroyErr.message);
            }
        });

        try {
            this.clients[libraryId] = client; // Cache the client immediately to prevent concurrent duplicate initializations!
            await client.initialize();

            // Wait for either the QR event or the Ready event to resolve, returning it in the HTTP response!
            const initResult = await waitForInit;
            return initResult;
        } catch (error) {
            delete this.clients[libraryId]; // Clean up cache on failure!
            try {
                console.log(`[${libraryId}] Cleaning up and destroying crashed client browser...`);
                await client.destroy();
            } catch (destroyErr) {
                console.warn(`[${libraryId}] Failed to destroy crashed client browser:`, destroyErr.message);
            }
            console.error(`[${libraryId}] Failed to initialize:`, error);
            this.sessionStates[libraryId] = { status: 'FAILED', qr: null };
            throw error;
        }
    }

    async getStatus(libraryId) {
        const client = this.clients[libraryId];
        if (!client) {
            const localState = this.sessionStates[libraryId] || { status: 'DISCONNECTED', qr: null };
            return { connected: false, state: localState.status, qrCode: localState.qr };
        }

        try {
            const state = await client.getState();
            const qr = this.sessionStates[libraryId] ? this.sessionStates[libraryId].qr : null;
            return { connected: state === 'CONNECTED', state: state, qrCode: qr };
        } catch (error) {
            const localState = this.sessionStates[libraryId] || { status: 'UNKNOWN', qr: null };
            return { connected: localState.status === 'CONNECTED', state: localState.status, qrCode: localState.qr };
        }
    }

    async sendMessageWithAttachment(libraryId, number, message, attachmentOptions = {}) {
        const client = this.clients[libraryId];
        if (!client) throw new Error('Session not initialized');

        let sanitizedNumber = number.toString().replace(/\D/g, '');

        // Ensure country code (default to 91 for India if exactly 10 digits)
        if (sanitizedNumber.length === 10) {
            sanitizedNumber = '91' + sanitizedNumber;
        } else if (sanitizedNumber.length === 11 && sanitizedNumber.startsWith('0')) {
            sanitizedNumber = '91' + sanitizedNumber.substring(1);
        }

        const formattedNumber = sanitizedNumber.includes('@c.us') ? sanitizedNumber : `${sanitizedNumber}@c.us`;

        const { file, url, base64, mimetype, filename } = attachmentOptions;
        let media = null;

        if (file && file.path) {
            media = MessageMedia.fromFilePath(file.path);
        } else if (url) {
            try {
                media = await MessageMedia.fromUrl(url, { unsafeMime: true });
            } catch (err) {
                console.error(`[WhatsApp] Failed to load media from URL ${url}:`, err.message);
                throw new Error(`Failed to load media from URL: ${err.message}`);
            }
        } else if (base64) {
            try {
                let cleanedBase64 = base64;
                let resolvedMimeType = mimetype || 'application/octet-stream';
                if (base64.startsWith('data:')) {
                    const parts = base64.split(';base64,');
                    resolvedMimeType = parts[0].replace('data:', '');
                    cleanedBase64 = parts[1];
                }
                media = new MessageMedia(resolvedMimeType, cleanedBase64, filename || 'attachment');
            } catch (err) {
                console.error(`[WhatsApp] Failed to parse base64 media:`, err.message);
                throw new Error(`Failed to parse base64 media: ${err.message}`);
            }
        }

        if (media) {
            return await client.sendMessage(formattedNumber, media, { caption: message || '' });
        } else {
            return await client.sendMessage(formattedNumber, message || '');
        }
    }
}

module.exports = new WhatsAppService();

