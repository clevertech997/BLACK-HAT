const fs = require('fs');
const path = require('path');

const warnFile = path.join(__dirname, '../data/warnings.json');

if (!fs.existsSync(warnFile)) {
    fs.writeFileSync(warnFile, JSON.stringify({}));
}

function loadWarn() {
    return JSON.parse(fs.readFileSync(warnFile));
}

function saveWarn(data) {
    fs.writeFileSync(warnFile, JSON.stringify(data, null, 2));
}

async function handleAntiBot(sock, update) {
    try {
        const { id, participants, action } = update;

        if (action !== 'add') return;

        const groupMetadata = await sock.groupMetadata(id);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        const botIsAdmin = groupMetadata.participants
            .find(p => p.id === botId)?.admin;

        if (!botIsAdmin) return;

        const warnings = loadWarn();

        for (const user of participants) {

            const number = user.split('@')[0];

            // Suspicious patterns
            const suspicious =
                number.length < 8 ||
                number.startsWith('0') ||
                number.includes('bot');

            if (suspicious) {

                await sock.groupParticipantsUpdate(id, [user], 'remove');

                const adder = update.author;

                if (!warnings[adder]) warnings[adder] = 0;
                warnings[adder] += 1;

                saveWarn(warnings);

                await sock.sendMessage(id, {
                    text: `🚨 ANTIBOT DETECTED 🚨\n\n❌ Bot removed: @${number}\n⚠️ Warning for: @${adder.split('@')[0]}\nWarnings: ${warnings[adder]}/3`,
                    mentions: [adder]
                });

                if (warnings[adder] >= 3) {
                    await sock.groupParticipantsUpdate(id, [adder], 'remove');
                    await sock.sendMessage(id, {
                        text: `💀 User removed for repeated bot adding.`,
                    });
                }
            }
        }

    } catch (err) {
        console.error('ANTIBOT ERROR:', err);
    }
}

module.exports = handleAntiBot;
