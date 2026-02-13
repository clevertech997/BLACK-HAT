const isOwnerOrSudo = require('../lib/isOwner');

async function getPPCommand(sock, chatId, message) {
    try {
        if (!message?.message) return;

        const sender = message.key.participant || message.key.remoteJid;
        const allowed = await isOwnerOrSudo(sender, sock, chatId);

        if (!allowed) {
            return await sock.sendMessage(chatId, {
                text: '🚫 OWNER ONLY COMMAND'
            }, { quoted: message });
        }

        const rawText =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const args = rawText.trim().split(/\s+/).slice(1);

        let jid;

        // 1️⃣ Reply detection
        const replyUser =
            message.message?.extendedTextMessage?.contextInfo?.participant;

        if (replyUser) {
            jid = replyUser;
        }

        // 2️⃣ Mention detection
        else if (
            message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length
        ) {
            jid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        // 3️⃣ Direct number
        else if (args[0]) {
            const clean = args[0].replace(/[^0-9]/g, '');
            jid = `${clean}@s.whatsapp.net`;
        }

        else {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Usage:\n.getpp <number>\nReply user\nMention user'
            }, { quoted: message });
        }

        // Check WA existence
        const exists = await sock.onWhatsApp(jid);
        if (!exists || !exists[0]?.exists) {
            return await sock.sendMessage(chatId, {
                text: '❌ Number not registered on WhatsApp.'
            }, { quoted: message });
        }

        // Fetch data
        let ppUrl = null;
        try { ppUrl = await sock.profilePictureUrl(jid, 'image'); } catch {}

        let bio = "No bio";
        try {
            const status = await sock.fetchStatus(jid);
            bio = status?.status || "No bio";
        } catch {}

        let contact;
        try { contact = await sock.getContact(jid); } catch {}

        const name = contact?.name || jid.split('@')[0];
        const isBusiness = contact?.isBusiness || false;

        let presence = "Unknown";
        try {
            const p = await sock.fetchPresence(jid);
            if (p?.presence === 'online') presence = "🟢 Online";
            else presence = "⚪ Offline";
        } catch {}

        // 🌍 Country Database
        const number = jid.split('@')[0];

        const countryCodes = {
            "255": "🇹🇿 Tanzania",
            "254": "🇰🇪 Kenya",
            "256": "🇺🇬 Uganda",
            "234": "🇳🇬 Nigeria",
            "233": "🇬🇭 Ghana",
            "1": "🇺🇸/🇨🇦 USA/Canada",
            "91": "🇮🇳 India",
            "44": "🇬🇧 United Kingdom",
            "971": "🇦🇪 UAE",
            "27": "🇿🇦 South Africa"
        };

        let country = "Unknown 🌍";
        for (const code in countryCodes) {
            if (number.startsWith(code)) {
                country = countryCodes[code];
                break;
            }
        }

        const infoText = `╭━━〔 ☠ BLACKHAT OSINT SCAN ☠ 〕━━╮
│ 🧑 Name      : ${name}
│ 📱 Number    : ${number}
│ 🌍 Country   : ${country}
│ 📇 WAID      : ${jid}
│ 💬 Bio       : ${bio}
│ 🏢 Type      : ${isBusiness ? "Business" : "Individual"}
│ ⏱ Presence  : ${presence}
╰━━━━━━━━━━━━━━━━━━━━╯`;

        const buttons = [
            {
                buttonId: `.dp ${number}`,
                buttonText: { displayText: "📥 Download DP" },
                type: 1
            },
            {
                buttonId: `.raw ${number}`,
                buttonText: { displayText: "📜 Raw JSON" },
                type: 1
            }
        ];

        if (ppUrl) {
            await sock.sendMessage(chatId, {
                image: { url: ppUrl },
                caption: infoText,
                buttons: buttons,
                headerType: 4
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: infoText,
                buttons: buttons,
                headerType: 1
            }, { quoted: message });
        }

    } catch (err) {
        console.error('[GETPP ULTRA ERROR]', err);
        await sock.sendMessage(chatId, {
            text: '❌ Scan failed.'
        }, { quoted: message });
    }
}

module.exports = getPPCommand;
