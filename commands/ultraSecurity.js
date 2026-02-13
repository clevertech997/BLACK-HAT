const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const filePath = path.join(dataDir, 'security.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function loadData() {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}), 'utf-8');
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
        console.error('[SECURITY LOAD ERROR]', err);
        return {};
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('[SECURITY SAVE ERROR]', err);
    }
}

const joinTracker = {};

async function securityCommand(sock, message, ownerNumber) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command.' }, { quoted: message });
        }

        const metadata = await sock.groupMetadata(chatId);
        const sender = message.key.participant;
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        const isAdmin = metadata.participants.some(p => p.id === sender && p.admin);
        const isBotAdmin = metadata.participants.some(p => p.id === botNumber && p.admin);
        const isOwner = sender === ownerNumber;

        if (!isAdmin && !isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Admin only.' }, { quoted: message });
        }

        if (!isBotAdmin) {
            return sock.sendMessage(chatId, { text: '❌ I need admin rights.' }, { quoted: message });
        }

        const body =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const args = body.trim().split(/\s+/).slice(1);
        const feature = args[0]?.toLowerCase();
        const action = args[1]?.toLowerCase();

        const validFeatures = ['antibot', 'antifake', 'antispam'];

        if (!validFeatures.includes(feature) || !['on','off'].includes(action)) {
            return sock.sendMessage(chatId, {
                text:
`🛡️ BLACK HAT SECURITY

Usage:
.security antibot on/off
.security antifake on/off
.security antispam on/off`
            }, { quoted: message });
        }

        const data = loadData();
        if (!data[chatId]) data[chatId] = {};

        data[chatId][feature] = action === 'on';
        saveData(data);

        await sock.sendMessage(chatId, {
            text: `🛡️ ${feature.toUpperCase()} is now *${action.toUpperCase()}*`
        }, { quoted: message });

    } catch (err) {
        console.error('[SECURITY CMD ERROR]', err);
    }
}

async function handleSecurity(sock, update, ownerNumber) {
    try {
        const { id, participants, action } = update;
        if (action !== 'add') return;

        const data = loadData();
        if (!data[id]) return;

        const metadata = await sock.groupMetadata(id);
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        const isBotAdmin = metadata.participants.some(
            p => p.id === botNumber && p.admin
        );
        if (!isBotAdmin) return;

        if (!joinTracker[id]) joinTracker[id] = [];

        for (let user of participants) {

            // OWNER IMMUNE
            if (user === ownerNumber) continue;

            // 🔥 AntiBot
            if (data[id].antibot) {
                if (user.includes('bot') || user.includes('Bot')) {
                    await sock.groupParticipantsUpdate(id, [user], 'remove');
                    await sock.sendMessage(id, {
                        text: `🚨 Bot removed:\n@${user.split('@')[0]}`,
                        mentions: [user]
                    });
                    continue;
                }
            }

            // 🔥 AntiFake (Only +255 allowed — change if needed)
            if (data[id].antifake) {
                if (!user.startsWith('255')) {
                    await sock.groupParticipantsUpdate(id, [user], 'remove');
                    await sock.sendMessage(id, {
                        text: `🚫 Fake number removed:\n@${user.split('@')[0]}`,
                        mentions: [user]
                    });
                    continue;
                }
            }

            // 🔥 AntiSpam Join
            if (data[id].antispam) {
                const now = Date.now();
                joinTracker[id].push(now);

                // remove timestamps older than 10 sec
                joinTracker[id] = joinTracker[id].filter(t => now - t < 10000);

                if (joinTracker[id].length > 5) {
                    await sock.groupParticipantsUpdate(id, [user], 'remove');
                    await sock.sendMessage(id, {
                        text: `⚠️ Spam join detected. User removed.`,
                        mentions: [user]
                    });
                }
            }
        }

    } catch (err) {
        console.error('[SECURITY DETECT ERROR]', err);
    }
}

module.exports = {
    securityCommand,
    handleSecurity
};
