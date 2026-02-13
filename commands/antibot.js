// antibot.js
const fs = require('fs');
const path = require('path');
const settings = require('../settings.js');
const isOwnerOrSudo = require('../lib/isOwner'); // optimized version

const antibotFile = path.join(__dirname, '..', 'data', 'antibot.json');
const warnFile = path.join(__dirname, '..', 'data', 'antibot_warns.json');

let warnData = {};
const WARN_LIMIT = 3;

// ================================
// Save/Load Functions
// ================================
function saveAntiBotStatus() {
    fs.writeFileSync(antibotFile, JSON.stringify({ antibot: !!settings.antibot, deleteMsg: !!settings.deleteMsg }, null, 2));
}
function loadAntiBotStatus() {
    if (!fs.existsSync(antibotFile)) saveAntiBotStatus();
    const data = JSON.parse(fs.readFileSync(antibotFile, 'utf-8'));
    settings.antibot = !!data.antibot;
    settings.deleteMsg = !!data.deleteMsg;
}
function saveWarns() { fs.writeFileSync(warnFile, JSON.stringify(warnData, null, 2)); }
function loadWarns() { if (fs.existsSync(warnFile)) warnData = JSON.parse(fs.readFileSync(warnFile, 'utf-8')); }

loadAntiBotStatus();
loadWarns();

// ================================
// AntiBot Command (Owner Only + Delete toggle)
// ================================
async function antiBotCommand(sock, message) {
    try {
        if (!message) return;
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        if (!(await isOwnerOrSudo(sender, sock, chatId))) {
            return await sock.sendMessage(chatId, { text: '🚫 OWNER ONLY COMMAND' }, { quoted: message });
        }

        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = body.trim().split(/\s+/).slice(1);
        const action = args[0]?.toLowerCase();
        const option = args[1]?.toLowerCase(); // delete toggle

        if (['on','off'].includes(action)) {
            settings.antibot = action === 'on';
            saveAntiBotStatus();
            return await sock.sendMessage(chatId, { text: `✅ AntiBot is now *${settings.antibot ? 'ENABLED 🟢' : 'DISABLED 🔴'}*` }, { quoted: message });
        }

        if (action === 'delete') {
            if (!option || !['on','off'].includes(option)) return await sock.sendMessage(chatId, { text: '⚠️ Usage: .antibot delete <on/off>' }, { quoted: message });
            settings.deleteMsg = option === 'on';
            saveAntiBotStatus();
            return await sock.sendMessage(chatId, { text: `✅ Auto-delete bot messages is now *${settings.deleteMsg ? 'ENABLED 🟢' : 'DISABLED 🔴'}*` }, { quoted: message });
        }

        // Invalid usage
        return await sock.sendMessage(chatId, { text: '⚠️ Usage:\n.antibot <on/off>\n.antibot delete <on/off>' }, { quoted: message });

    } catch (err) {
        console.error('[ANTIBOT CMD ERROR]', err);
        if (message?.key?.remoteJid) await sock.sendMessage(message.key.remoteJid, { text: '❌ Error processing .antibot command.' }, { quoted: message });
    }
}

// ================================
// AntiBot Handler (Auto Warn/Kick/Block/Delete)
// ================================
async function handleAntiBot(sock, message) {
    if (!settings.antibot || !message) return;

    const chatId = message.key?.remoteJid;
    const sender = message.key?.participant;

    if (!chatId || !sender) return;
    if (!chatId.endsWith('@g.us')) return;
    if (await isOwnerOrSudo(sender, sock, chatId)) return;

    try {
        const isBotMessage = message.key.id.startsWith('BAE5') || message.key.id.length > 20;
        if (!isBotMessage) return;

        if (!warnData[chatId]) warnData[chatId] = {};
        if (!warnData[chatId][sender]) warnData[chatId][sender] = 0;
        warnData[chatId][sender] += 1;
        saveWarns();

        const warns = warnData[chatId][sender];

        await sock.sendMessage(chatId, { text: `⚠️ @${sender.split('@')[0]} Bots are not allowed!\nWarning ${warns}/${WARN_LIMIT}`, mentions: [sender] });

        // Delete bot message if enabled
        if (settings.deleteMsg) {
            try { await sock.sendMessage(chatId, { delete: message.key }); } catch {}
        }

        // Kick & Block after WARN_LIMIT
        if (warns >= WARN_LIMIT) {
            try {
                await sock.groupRemove(chatId, [sender]);
                await sock.sendMessage(chatId, { text: `🚫 @${sender.split('@')[0]} removed (Bot detected).`, mentions: [sender] });
                await sock.updateBlockStatus(sender, 'block');
            } catch (kickErr) { console.error('[ANTIBOT KICK/BLOCK ERROR]', kickErr); }

            delete warnData[chatId][sender];
            saveWarns();
        }

    } catch (err) { console.error('[ANTIBOT HANDLER ERROR]', err); }
}

module.exports = { antiBotCommand, handleAntiBot };
