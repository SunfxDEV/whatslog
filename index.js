const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Ensure log directory exists
const LOG_DIR = './logs';
if (!fs.existsSync(LOG_DIR)){
    fs.mkdirSync(LOG_DIR);
}

const HISTORY_FILE = path.join(LOG_DIR, 'history.jsonl');
const REVOKE_FILE = path.join(LOG_DIR, 'revoked_events.jsonl');

// Initialize Client with Puppeteer configurations for Docker
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/usr/src/app/.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Generate QR Code for authentication
client.on('qr', (qr) => {
    console.log('SCAN THIS QR CODE TO LOGIN:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready and listening!');
});

// 1. SAVE INCOMING MESSAGES
client.on('message_create', async msg => {
    // Only log text messages or easy-to-read types
    if(msg.body) {
        const logEntry = {
            id: msg.id.id,
            timestamp: new Date().toISOString(),
            sender: msg.from, // Number or Group ID
            author: msg.author, // Actual sender in a group
            content: msg.body,
            hasMedia: msg.hasMedia
        };

        // Append to history file (JSONL format)
        fs.appendFile(HISTORY_FILE, JSON.stringify(logEntry) + '\n', (err) => {
            if (err) console.error('Error writing to log:', err);
        });
    }
});

// 2. CAPTURE DELETION EVENTS
// This event fires when someone uses "Delete for Everyone"
client.on('message_revoke_everyone', async (after, before) => {
    if (before) {
        console.log(`[ALERT] Message deleted: "${before.body}"`);

        const revokeEntry = {
            deleted_at: new Date().toISOString(),
            original_message_id: before.id.id,
            original_content: before.body, // We log it again just in case
            sender: before.from
        };

        fs.appendFile(REVOKE_FILE, JSON.stringify(revokeEntry) + '\n', (err) => {
            if (err) console.error('Error logging revocation:', err);
        });
    }
});

client.initialize();