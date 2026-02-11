const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

const messageStore = new Map();
const CONFIG_PATH = path.join(__dirname, '../data/antidelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

/* ================= STREAM FIX ================= */

const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

/* ================= CLEAN TEMP ================= */

const getFolderSizeInMB = (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath);
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                totalSize += fs.statSync(filePath).size;
            }
        }
        return totalSize / (1024 * 1024);
    } catch {
        return 0;
    }
};

const cleanTempFolderIfLarge = () => {
    try {
        if (getFolderSizeInMB(TEMP_MEDIA_DIR) > 200) {
            const files = fs.readdirSync(TEMP_MEDIA_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(TEMP_MEDIA_DIR, file));
            }
        }
    } catch {}
};

setInterval(cleanTempFolderIfLarge, 60 * 1000);

/* ================= CONFIG ================= */

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH));
    } catch {
        return { enabled: false };
    }
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

const isOwnerOrSudo = require('../lib/isOwner');

/* ================= COMMAND ================= */

async function handleAntideleteCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, {
            text: '*Only the bot owner can use this command.*'
        }, { quoted: message });
    }

    const config = loadConfig();

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*ANTIDELETE SETUP*\n\nStatus: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n.antidelete on\n.antidelete off`
        }, { quoted: message });
    }

    config.enabled = match === 'on';
    saveConfig(config);

    return sock.sendMessage(chatId, {
        text: `*Antidelete ${config.enabled ? 'Enabled ✅' : 'Disabled ❌'}*`
    }, { quoted: message });
}

/* ================= STORE MESSAGE ================= */

async function storeMessage(sock, message) {
    try {
        const config = loadConfig();
        if (!config.enabled) return;
        if (!message.key?.id) return;

        const messageId = message.key.id;
        const sender = message.key.participant || message.key.remoteJid;

        let content = '';
        let mediaType = '';
        let mediaPath = '';

        const viewOnce =
            message.message?.viewOnceMessageV2?.message ||
            message.message?.viewOnceMessage?.message;

        const msg = viewOnce || message.message;

        if (!msg) return;

        /* ===== TEXT ===== */
        if (msg.conversation) {
            content = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            content = msg.extendedTextMessage.text;
        }

        /* ===== IMAGE ===== */
        if (msg.imageMessage?.mediaKey) {
            mediaType = 'image';
            content = msg.imageMessage.caption || '';
            const stream = await downloadContentFromMessage(msg.imageMessage, 'image');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
            await writeFile(mediaPath, buffer);
        }

        /* ===== VIDEO ===== */
        else if (msg.videoMessage?.mediaKey) {
            mediaType = 'video';
            content = msg.videoMessage.caption || '';
            const stream = await downloadContentFromMessage(msg.videoMessage, 'video');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
            await writeFile(mediaPath, buffer);
        }

        /* ===== STICKER ===== */
        else if (msg.stickerMessage?.mediaKey) {
            mediaType = 'sticker';
            const stream = await downloadContentFromMessage(msg.stickerMessage, 'sticker');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
            await writeFile(mediaPath, buffer);
        }

        /* ===== AUDIO ===== */
        else if (msg.audioMessage?.mediaKey) {
            mediaType = 'audio';
            const stream = await downloadContentFromMessage(msg.audioMessage, 'audio');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp3`);
            await writeFile(mediaPath, buffer);
        }

        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null
        });

    } catch (err) {
        console.error('storeMessage error:', err.message);
    }
}

/* ================= HANDLE DELETE ================= */

async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const config = loadConfig();
        if (!config.enabled) return;

        const messageId = revocationMessage.message.protocolMessage.key.id;
        const deleted = messageStore.get(messageId);
        if (!deleted) return;

        const owner = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const senderName = deleted.sender.split('@')[0];

        const time = new Date().toLocaleString('en-TZ', {
            timeZone: 'Africa/Dar_es_Salaam'
        });

        let text =
`🗑️ *ANTIDELETE REPORT*

👤 Sender: @${senderName}
🕒 Time: ${time}

💬 Message:
${deleted.content || 'Media Message'}
`;

        await sock.sendMessage(owner, {
            text,
            mentions: [deleted.sender]
        });

        if (deleted.mediaType && fs.existsSync(deleted.mediaPath)) {
            const mediaData = { url: deleted.mediaPath };

            if (deleted.mediaType === 'image')
                await sock.sendMessage(owner, { image: mediaData });

            if (deleted.mediaType === 'video')
                await sock.sendMessage(owner, { video: mediaData });

            if (deleted.mediaType === 'sticker')
                await sock.sendMessage(owner, { sticker: mediaData });

            if (deleted.mediaType === 'audio')
                await sock.sendMessage(owner, { audio: mediaData, mimetype: 'audio/mpeg' });

            fs.unlinkSync(deleted.mediaPath);
        }

        messageStore.delete(messageId);

    } catch (err) {
        console.error('handleMessageRevocation error:', err.message);
    }
}

module.exports = {
    handleAntideleteCommand,
    storeMessage,
    handleMessageRevocation
};
