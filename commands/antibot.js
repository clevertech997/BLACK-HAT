const fs = require('fs');
const path = require('path');
const settings = require('./settings.js'); // current folder

const antibotFile = path.join(__dirname, 'data', 'antibot.json');
const warnFile = path.join(__dirname, 'data', 'antibot_warns.json');

// ================================
// Save/Load AntiBot Status
// ================================
function saveAntiBotStatus() {
    try {
        fs.writeFileSync(antibotFile, JSON.stringify({ antibot: !!settings.antibot }, null, 2));
    } catch (err) {
        console.error('[ANTIBOT] Failed to save status:', err);
    }
}

function loadAntiBotStatus() {
    try {
        if (!fs.existsSync(antibotFile)) {
            saveAntiBotStatus();
            return;
        }
        const data = JSON.parse(fs.readFileSync(antibotFile, 'utf-8'));
        settings.antibot = !!data.antibot;
    } catch (err) {
        console.error('[ANTIBOT] Failed to load status:', err);
        settings.antibot = false;
        saveAntiBotStatus();
    }
}

loadAntiBotStatus();

// ================================
// Warn Tracking
// ================================
let warnData = {};

function loadWarns() {
    try {
        if (fs.existsSync(warnFile)) {
            warnData = JSON.parse(fs.readFileSync(warnFile, 'utf-8'));
        }
    } catch (err) {
        console.error('[ANTIBOT] Failed to load warns:', err);
        warnData = {};
    }
}

function saveWarns() {
    try {
        fs.writeFileSync(warnFile, JSON.stringify(warnData, null, 2));
    } catch (err) {
        console.error('[ANTIBOT] Failed to save warns:', err);
    }
}

loadWarns();

// ================================
// Command to toggle AntiBot
// ================================
async function antiBotCommand(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        const body = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = body.trim().split(/\s+/).slice(1);
        const action = args[0]?.toLowerCase();

        if (!action || !['on', 'off'].includes(action)) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Usage: .antibot <on/off>\nExample: .antibot on'
            }, { quoted: message });
        }

        settings.antibot = action === 'on';
        saveAntiBotStatus();

        await sock.sendMessage(chatId, {
            text: `✅ AntiBot is now *${settings.antibot ? 'ENABLED' : 'DISABLED'}*`
        }, { quoted: message });

    } catch (err) {
        console.error('[ANTIBOT CMD] Error:', err);
        try {
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Failed to toggle AntiBot due to an error.'
            }, { quoted: message });
        } catch {}
    }
}

// ================================
// Handle messages for AntiBot
// ================================
async function handleAntiBot(sock, message) {
    if (!settings.antibot) return;

    try {
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // Detect status/spam messages
        const isStatusMessage =
            message.message?.statusBroadcast ||
            (message.message?.protocolMessage?.type === 0); // adjust if needed

        if (isStatusMessage) {
            // Initialize warn count
            if (!warnData[chatId]) warnData[chatId] = {};
            if (!warnData[chatId][sender]) warnData[chatId][sender] = 0;

            warnData[chatId][sender] += 1;
            saveWarns();

            const warns = warnData[chatId][sender];

            // Send warn message
            await sock.sendMessage(chatId, {
                text: `⚠️ @${sender.split('@')[0]}, sending status/spam messages is not allowed!\nWarning ${warns}/3`,
                mentions: [sender]
            });

            // Delete offending message
            await sock.sendMessage(chatId, { delete: message.key });

            // Auto kick after 3 warns
            if (warns >= 3) {
                try {
                    await sock.groupRemove(chatId, [sender]);
                    await sock.sendMessage(chatId, {
                        text: `🚫 @${sender.split('@')[0]} has been removed from the group after 3 warnings.`,
                        mentions: [sender]
                    });

                    // Reset warns for this user
                    delete warnData[chatId][sender];
                    saveWarns();
                } catch (err) {
                    console.error('[ANTIBOT] Failed to kick user:', err);
                }
            }
        }

    } catch (err) {
        console.error('[ANTIBOT HANDLER] Error:', err);
    }
}

module.exports = { antiBotCommand, handleAntiBot };
