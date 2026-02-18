const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../data/antidelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');
const MAX_TEMP_SIZE_MB = 200;

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

const isOwnerOrSudo = require('../lib/isOwner');



/* -------------------- UTILITY FUNCTIONS -------------------- */

// Properly convert Baileys stream → buffer
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function saveMedia(messageObj, type, messageId, extension) {
    const stream = await downloadContentFromMessage(messageObj, type);
    const buffer = await streamToBuffer(stream);

    const filePath = path.join(TEMP_MEDIA_DIR, `${messageId}.${extension}`);
    await writeFile(filePath, buffer);

    return filePath;
}

function getFolderSizeMB(folder) {
    let total = 0;
    const files = fs.readdirSync(folder);

    for (const file of files) {
        const filePath = path.join(folder, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) total += stat.size;
    }

    return total / (1024 * 1024);
}

// Smarter cleanup (delete oldest first)
function cleanTempFolder() {
    try {
        const size = getFolderSizeMB(TEMP_MEDIA_DIR);
        if (size <= MAX_TEMP_SIZE_MB) return;

        const files = fs.readdirSync(TEMP_MEDIA_DIR)
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(TEMP_MEDIA_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => a.time - b.time); // oldest first

        for (const file of files) {
            fs.unlinkSync(path.join(TEMP_MEDIA_DIR, file.name));
            if (getFolderSizeMB(TEMP_MEDIA_DIR) <= MAX_TEMP_SIZE_MB) break;
        }

    } catch (err) {
        console.error('Temp cleanup error:', err);
    }
}

setInterval(cleanTempFolder, 60 * 1000);



/* -------------------- CONFIG -------------------- */

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH));
    } catch {
        return { enabled: false };
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Config save error:', err);
    }
}



/* -------------------- COMMAND -------------------- */

async function handleAntideleteCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId,
            { text: '❌ Only bot owner can use this command.' },
            { quoted: message }
        );
    }

    const config = loadConfig();

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*ANTIDELETE SETTINGS*

Status: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}

.antidelete on
.antidelete off`
        }, { quoted: message });
    }

    if (match === 'on') config.enabled = true;
    else if (match === 'off') config.enabled = false;
    else {
        return sock.sendMessage(chatId,
            { text: 'Invalid option. Use .antidelete' },
            { quoted: message }
        );
    }

    saveConfig(config);

    return sock.sendMessage(chatId,
        { text: `✅ Antidelete ${config.enabled ? 'Enabled' : 'Disabled'}` },
        { quoted: message }
    );
}



/* -------------------- STORE MESSAGE -------------------- */

async function storeMessage(sock, message) {
    try {
        if (!loadConfig().enabled) return;
        if (!message.key?.id) return;

        const messageId = message.key.id;
        const sender = message.key.participant || message.key.remoteJid;

        let content = '';
        let mediaType = '';
        let mediaPath = '';

        const msg = message.message;

        // TEXT
        if (msg?.conversation) {
            content = msg.conversation;
        } else if (msg?.extendedTextMessage?.text) {
            content = msg.extendedTextMessage.text;
        }

        // IMAGE
        else if (msg?.imageMessage) {
            mediaType = 'image';
            content = msg.imageMessage.caption || '';
            mediaPath = await saveMedia(msg.imageMessage, 'image', messageId, 'jpg');
        }

        // VIDEO
        else if (msg?.videoMessage) {
            mediaType = 'video';
            content = msg.videoMessage.caption || '';
            mediaPath = await saveMedia(msg.videoMessage, 'video', messageId, 'mp4');
        }

        // AUDIO
        else if (msg?.audioMessage) {
            mediaType = 'audio';
            mediaPath = await saveMedia(msg.audioMessage, 'audio', messageId, 'mp3');
        }

        // STICKER
        else if (msg?.stickerMessage) {
            mediaType = 'sticker';
            mediaPath = await saveMedia(msg.stickerMessage, 'sticker', messageId, 'webp');
        }

        messageStore.set(messageId, {
            sender,
            content,
            mediaType,
            mediaPath,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null
        });

    } catch (err) {
        console.error('storeMessage error:', err);
    }
}



/* -------------------- HANDLE DELETE -------------------- */

async function handleMessageRevocation(sock, rev) {
    try {
        if (!loadConfig().enabled) return;

        const messageId = rev.message.protocolMessage.key.id;
        const original = messageStore.get(messageId);
        if (!original) return;

        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const sender = original.sender;

        let report = `🔰 *ANTIDELETE REPORT*

👤 Sender: @${sender.split('@')[0]}
📱 Number: ${sender}`;

        if (original.content) {
            report += `

💬 Message:
${original.content}`;
        }

        await sock.sendMessage(ownerNumber, {
            text: report,
            mentions: [sender]
        });

        // Send media if exists
        if (original.mediaType && fs.existsSync(original.mediaPath)) {
            await sock.sendMessage(ownerNumber, {
                [original.mediaType]: { url: original.mediaPath }
            });

            try { fs.unlinkSync(original.mediaPath); } catch {}
        }

        messageStore.delete(messageId);

    } catch (err) {
        console.error('handleMessageRevocation error:', err);
    }
}



module.exports = {
    handleAntideleteCommand,
    storeMessage,
    handleMessageRevocation
};
