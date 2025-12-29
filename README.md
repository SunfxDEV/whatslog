# 📱 WhatsApp Logger & Anti-Delete Bot ARM Branch
For normal x86/x64 switch branch

A lightweight WhatsApp bot based on [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) that monitors messages in real-time and logs deleted messages.

The bot runs entirely within a Docker container, maintains persistent session data, and offers easy configuration.

## ✨ Features

* **Anti-Delete:** Logs messages that have been deleted by others ("This message was deleted").
* **Auto-Reply (Optional):** Automatically replies to the chat when a message is deleted (e.g., "I saw that!").
* **Logging:** Saves messages and events to local JSONL files in `logs/`.
* **Memory Cache:** Caches recent messages in RAM to retrieve them upon deletion.
* **Dockerized:** Easy deployment without manual Chrome/dependency installation.

## 🚀 Installation & Start (Docker)

This is the recommended method, as all dependencies (Puppeteer, Node.js) are isolated within the container.

### 1. Clone the Repository
Clone this project to your server or local machine.

### 2. Start the Container
Run the following command in the project directory:

```bash
docker-compose up -d --build
```

### 3. Scan the QR Code

The bot generates a QR code that you need to scan with your WhatsApp (Linked Devices). To view the QR code, check the logs:

```bash
docker-compose logs -f wa-logger
```

*Once scanned, you will see the message `Client is ready!`.*

## ⚙️ Configuration

Settings can be adjusted directly in the `index.js` file under the `CONFIGURATION SECTION`.

Since `index.js` is mounted as a volume in `docker-compose.yml`, you can edit the file locally and simply restart the container to apply changes.

| Setting | Values | Description |
| --- | --- | --- |
| `LOG_STRATEGY` | `'ALL'` or `'DELETED_ONLY'` | `'ALL'` saves every message to `history.jsonl`. `'DELETED_ONLY'` saves only revoked messages. |
| `ENABLE_PUBLIC_ALERT` | `true` or `false` | If `true`, the bot sends a message to the chat immediately after a message is deleted. |
| `ALERT_TEXT` | String | The text the bot sends (e.g., "I saw that! 👁️"). |

**Example:**

```javascript
const CONFIG = {
    LOG_STRATEGY: 'DELETED_ONLY',
    ENABLE_PUBLIC_ALERT: false, // Set to false for "Silent Mode"
    ALERT_TEXT: "I saw that! 👁️"
};

```

Apply changes by restarting the bot:

```bash
docker-compose restart wa-logger

```

## 📂 File Structure & Logs

After starting, the bot creates the following folders/files:

* **`/auth_data`**: Stores the WhatsApp session. As long as this folder exists, you do not need to rescan the QR code after a restart.
* **`/logs/history.jsonl`**: Contains all messages (if strategy is set to `ALL`).
* **`/logs/revoked_events.jsonl`**: Contains deleted messages with content, sender, and timestamp.

## 🛠️ Manual Installation (Without Docker)

If you have Node.js installed locally:

1. `npm install`
2. `node index.js`
3. Scan the QR code in the terminal.

> **Note:** This requires Chromium/Chrome to be installed on your system, which may cause compatibility issues. The Docker method is recommended.

## ⚠️ Disclaimer

This project is for educational purposes only. Logging other users' messages without their consent may violate WhatsApp's Terms of Service or local privacy laws. Use at your own risk.



