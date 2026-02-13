const fs = require('fs');
const settings = require('./settings.js'); // current folder

const antibotFile = './data/antibot.json';

function saveAntiBotStatus() {
    fs.writeFileSync(antibotFile, JSON.stringify({ antibot: settings.antibot || false }));
}

function loadAntiBotStatus() {
    if (fs.existsSync(antibotFile)) {
        const data = JSON.parse(fs.readFileSync(antibotFile, 'utf-8'));
        settings.antibot = data.antibot || false;
    } else {
        saveAntiBotStatus();
    }
}

loadAntiBotStatus();

async function antiBotCommand(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        const body =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const args = body.split(' ').slice(1);
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
        await sock.sendMessage(message.key.remoteJid, {
            text: '❌ Failed to toggle AntiBot.'
        }, { quoted: message });
    }
}

module.exports = antiBotCommand;
