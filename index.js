const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// =========================================================
//  CONFIGURATION SECTION
// =========================================================

const CONFIG = {
    // 'ALL' or 'DELETED_ONLY'
    LOG_STRATEGY: 'DELETED_ONLY',

    // Set to true to reply to the chat when a message is deleted
    ENABLE_PUBLIC_ALERT: false,

    // The message you want the bot to say
    ALERT_TEXT: "I saw that! 👁️ This message has been logged to my server."
};

// =========================================================
//  SETUP
// =========================================================

const LOG_DIR = './logs';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const HISTORY_FILE = path.join(LOG_DIR, 'history.jsonl');
const REVOKE_FILE = path.join(LOG_DIR, 'revoked_events.jsonl');

// RAM Cache to store recent messages
const messageCache = new Map();

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/usr/src/app/.wwebjs_auth' }),
    puppeteer: {
        executablePath: '/usr/bin/chromium',

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

function cleanCache() {
    if (messageCache.size > 5000) {
        const keysToDelete = Array.from(messageCache.keys()).slice(0, 1000);
        keysToDelete.forEach(key => messageCache.delete(key));
    }
}

// =========================================================
//  BOT LOGIC
// =========================================================

client.on('qr', (qr) => {
    console.log('SCAN THIS QR CODE TO LOGIN:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`Client is ready! Mode: ${CONFIG.LOG_STRATEGY}`);
});

// 1. LISTEN FOR INCOMING MESSAGES
client.on('message_create', async msg => {
    if(msg.body) {
        try {
            // SAFE EXTRACTION: We stop using getContact() as it causes crashes
            // We strip the suffix (@c.us) to get the number
            const safeNumber = msg.from.replace(/@c.us|@g.us/g, '');

            // Try to get chat name safely
            let chatName = 'Unknown Chat';
            try {
                const chat = await msg.getChat();
                chatName = chat.name || safeNumber;
            } catch(e) {
                chatName = safeNumber;
            }

            const logEntry = {
                id: msg.id.id,
                timestamp: new Date().toISOString(),
                sender_number: `+${safeNumber}`,
                chat_name: chatName,
                content: msg.body,
                hasMedia: msg.hasMedia,
                remote_chat_id: msg.id.remote // Store this for later use
            };

            // Save to RAM
            messageCache.set(msg.id.id, logEntry);
            cleanCache();

            if (CONFIG.LOG_STRATEGY === 'ALL') {
                fs.appendFile(HISTORY_FILE, JSON.stringify(logEntry) + '\n', (err) => {
                    if (err) console.error('Error writing to history:', err);
                });
            }

        } catch (error) {
            console.error('Error processing message:', error.message);
        }
    }
});

client.on('message_revoke_everyone', async (after, before) => {
    try {
        const msgId = after.id.id;
        const cachedMsg = messageCache.get(msgId);

        // Use cached message or fallback to 'before'
        const finalLog = cachedMsg || (before ? {
            timestamp: new Date().toISOString(),
            content: before.body,
            sender_number: "Unknown (Not in cache)",
            id: before.id.id,
            remote_chat_id: before.id.remote
        } : null);

        if (finalLog) {
            console.log(`[ALERT] Message deleted: "${finalLog.content}"`);

            // Write to log
            const revokeEntry = { ...finalLog, deleted_at: new Date().toISOString() };
            fs.appendFile(REVOKE_FILE, JSON.stringify(revokeEntry) + '\n', (err) => {
                if (err) console.error('Error logging revocation:', err);
            });

            // Send Public Alert
            if (CONFIG.ENABLE_PUBLIC_ALERT) {
                if(finalLog.remote_chat_id) {
                    client.sendMessage(finalLog.remote_chat_id, CONFIG.ALERT_TEXT).catch(e => {
                        console.error("Could not send alert message:", e.message);
                    });
                }
            }
        }
    } catch (error) {
        // This prevents the bot from crashing if something goes wrong here
        console.error("CRITICAL ERROR in revocation handler (Bot continued running):", error);
    }
});

client.initialize();

// =========================================================
//  GRACEFUL SHUTDOWN HANDLER
// =========================================================
// This ensures Chrome closes if the bot crashes or is stopped

const cleanup = async (signal) => {
    console.log(`[SYSTEM] Received ${signal}. Shutting down gracefully...`);
    try {
        // Save cache one last time
        saveCacheToDisk();

        // Destroy the client (closes the browser)
        await client.destroy();
        console.log('[SYSTEM] Client destroyed.');
    } catch (err) {
        console.error('[SYSTEM] Error during cleanup:', err.message);
    } finally {
        console.log('[SYSTEM] Exiting now.');
        process.exit(0);
    }
};

// Listen for termination signals
process.on('SIGINT', () => cleanup('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => cleanup('SIGTERM')); // Docker stop
process.on('SIGHUP', () => cleanup('SIGHUP'));   // Terminal closed

// Optional: Catch unhandled crashes
process.on('uncaughtException', async (err) => {
    console.error('[SYSTEM] Uncaught Exception:', err);
    await cleanup('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[SYSTEM] Unhandled Rejection at:', promise, 'reason:', reason);
});