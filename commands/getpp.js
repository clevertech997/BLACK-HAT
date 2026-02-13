// getPP.js
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

async function getPPCommand(sock, chatId, message) {
    try {
        if (!message) return;

        const sender = message.key.participant || message.key.remoteJid;

        // ✅ Owner or Sudo check using optimized function
        const allowed = await isOwnerOrSudo(sender, sock, chatId);
        if (!allowed) {
            return await sock.sendMessage(chatId, { text: '🚫 OWNER ONLY COMMAND' }, { quoted: message });
        }

        let jid;

        // Reply check
        const replyUser = message.message?.extendedTextMessage?.contextInfo?.participant;
        if (replyUser) {
            jid = replyUser;
        } else {
            const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            const args = rawText.trim().split(/\s+/).slice(1);
            if (!args[0]) {
                return await sock.sendMessage(chatId, {
                    text: '⚠️ Usage:\n.getpp <number>\nOR reply to user with .getpp'
                }, { quoted: message });
            }

            const cleanNumber = args[0].replace(/[^0-9]/g, '');
            jid = `${cleanNumber}@s.whatsapp.net`;
        }

        // Check WhatsApp existence
        const exists = await sock.onWhatsApp(jid);
        if (!exists || !exists[0]?.exists) {
            return await sock.sendMessage(chatId, { text: '❌ Number not registered on WhatsApp.' }, { quoted: message });
        }

        // Profile picture
        let ppUrl = null;
        try { ppUrl = await sock.profilePictureUrl(jid, 'image'); } catch {}

        // Bio/status
        let bio = "No bio";
        try {
            const statusData = await sock.fetchStatus(jid);
            bio = statusData?.status || "No bio";
        } catch {}

        // Contact info
        let contact;
        try { contact = await sock.getContact(jid); } catch {}
        const name = contact?.name || jid.split('@')[0];
        const isBusiness = contact?.isBusiness || false;

        // Presence
        let presence = 'Unknown';
        try {
            const p = await sock.fetchPresence(jid);
            presence = p?.presence === 'online' ? '🟢 Online' : '⚪ Offline';
        } catch {}

        // Country detect
        const numberOnly = jid.split('@')[0];
        const countryMap = { "255": "🇹🇿 Tanzania", "254": "🇰🇪 Kenya", "256": "🇺🇬 Uganda", "234": "🇳🇬 Nigeria", "1": "🇺🇸/🇨🇦 USA/Canada", "91": "🇮🇳 India", "44": "🇬🇧 UK" };
        let country = "Unknown 🌍";
        for (const code in countryMap) if (numberOnly.startsWith(code)) { country = countryMap[code]; break; }

        // Group info (if applicable)
        let groupInfo = "";
        if (jid.endsWith('@g.us')) {
            try {
                const meta = await sock.groupMetadata(jid);
                groupInfo = `│👥 Members    : ${meta.participants.length}\n│📝 Subject    : ${meta.subject}`;
            } catch { groupInfo = "│👥 Group info unavailable"; }
        }

        // Hacker-style info text
        const infoText = `╭━━━━━━━━━━━━━━━━━━━╮
┃ ☠️ BLACKHAT ULTRA SCAN ☠️
╰━━━━━━━━━━━━━━━━━━━╯
│🧑 Name        : ${name}
│📱 Number      : ${numberOnly}
│🌍 Country     : ${country}
│📇 WAID        : ${jid}
│💬 Bio         : ${bio}
│🏢 Type        : ${isBusiness ? "Business 🏢" : "Individual 👤"}
│⏱️ Presence    : ${presence}
${groupInfo ? groupInfo + "\n" : ""}╰━━━━━━━━━━━━━━━━━━━╯`;

        // Send result
        if (ppUrl) {
            await sock.sendMessage(chatId, { image: { url: ppUrl }, caption: infoText }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: infoText }, { quoted: message });
        }

    } catch (err) {
        console.error('[GETPP ULTRA ERROR]', err);
        if (message?.key?.remoteJid) {
            await sock.sendMessage(chatId, { text: '❌ Scan failed.' }, { quoted: message });
        }
    }
}

module.exports = getPPCommand;
