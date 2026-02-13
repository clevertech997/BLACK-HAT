const fs = require('fs');
const path = require('path');
const settings = require('../settings.js');
const isOwnerOrSudo = require('../lib/isOwner');

const antibotFile = path.join(__dirname, '..', 'data', 'antibot.json');
const warnFile = path.join(__dirname, '..', 'data', 'antibot_warns.json');

let warnData = {};

// ================================
// Save/Load Functions
// ================================
function saveAntiBotStatus() {
    fs.writeFileSync(antibotFile, JSON.stringify({ antibot: !!settings.antibot }, null, 2));
}
function loadAntiBotStatus() {
    if (!fs.existsSync(antibotFile)) saveAntiBotStatus();
    const data = JSON.parse(fs.readFileSync(antibotFile, 'utf-8'));
    settings.antibot = !!data.antibot;
}

function saveWarns() {
    fs.writeFileSync(warnFile, JSON.stringify(warnData, null, 2));
}
function loadWarns() {
    if (fs.existsSync(warnFile)) warnData = JSON.parse(fs.readFileSync(warnFile, 'utf-8'));
}

loadAntiBotStatus();
loadWarns();

// ================================
// AntiBot Command (Owner Only)
// ================================
async function antiBotCommand(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        if (!(await isOwnerOrSudo(sender))) {
            return await sock.sendMessage(chatId, { text: '🚫 OWNER ONLY COMMAND' }, { quoted: message });
        }

        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = body.trim().split(/\s+/).slice(1);
        const action = args[0]?.toLowerCase();

        if (!action || !['on','off'].includes(action)) {
            return await sock.sendMessage(chatId, { text: '⚠️ Usage: .antibot <on/off>' }, { quoted: message });
        }

        settings.antibot = action === 'on';
        saveAntiBotStatus();

        await sock.sendMessage(chatId, { text: `✅ AntiBot is now *${settings.antibot ? 'ENABLED 🟢' : 'DISABLED 🔴'}*` }, { quoted: message });
    } catch (err) {
        console.error('[ANTIBOT CMD ERROR]', err);
    }
}

// ================================
// AntiBot Handler (Auto Warn/Kick/Block)
// ================================
async function handleAntiBot(sock, message) {
    if (!settings.antibot) return;
    const chatId = message.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return;

    try {
        const sender = message.key.participant;
        if (!sender) return;

        if (await isOwnerOrSudo(sender)) return;

        // Detect bot messages
        const isBotMessage = message.key.id.startsWith('BAE5') || message.key.id.length > 20;
        if (!isBotMessage) return;

        if (!warnData[chatId]) warnData[chatId] = {};
        if (!warnData[chatId][sender]) warnData[chatId][sender] = 0;

        warnData[chatId][sender] += 1;
        saveWarns();

        const warns = warnData[chatId][sender];

        await sock.sendMessage(chatId, {
            text: `⚠️ @${sender.split('@')[0]} Bots are not allowed!\nWarning ${warns}/3`,
            mentions: [sender]
        });

        // Delete bot message
        await sock.sendMessage(chatId, { delete: message.key });

        // Kick & Block after 3 warns
        if (warns >= 3) {
            try {
                await sock.groupRemove(chatId, [sender]);
                await sock.sendMessage(chatId, { text: `🚫 @${sender.split('@')[0]} removed (Bot detected).`, mentions: [sender] });
                
                // Auto block
                await sock.updateBlockStatus(sender, 'block');

            } catch (kickErr) {
                console.error('[ANTIBOT KICK/BLOCK ERROR]', kickErr);
            }

            // Clean up
            delete warnData[chatId][sender];
            saveWarns();
        }

    } catch (err) {
        console.error('[ANTIBOT HANDLER ERROR]', err);
    }
}

module.exports = { antiBotCommand, handleAntiBot };
