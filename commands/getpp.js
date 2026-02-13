const settings = require('../settings'); // Hakikisha settings ina ownerNumber

async function getPPCommand(sock, chatId, message) {
    try {
        const sender = message.key.participant || message.key.remoteJid;

        // 🔒 Check if sender is owner
        if (sender !== settings.ownerNumber + '@s.whatsapp.net') {
            return await sock.sendMessage(chatId, {
                text: '❌ You are not authorized to use this command.'
            }, { quoted: message });
        }

        let jid;

        // 1️⃣ Angalia kama user amereply
        if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            jid = message.message.extendedTextMessage.contextInfo.participant;
        } else {
            // 2️⃣ Pata number kutoka message
            const rawText = message.message?.conversation?.trim() ||
                            message.message?.extendedTextMessage?.text?.trim() ||
                            '';
            const used = rawText.split(/\s+/)[0] || '.getpp';
            const number = rawText.slice(used.length).trim();

            if (!number) {
                return await sock.sendMessage(
                    chatId,
                    { text: '⚠️ Usage:\n.getpp <number>\nOR reply to a user with .getpp' },
                    { quoted: message }
                );
            }

            jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
        }

        // 3️⃣ Pata profile picture URL
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(jid, 'image');
        } catch {
            ppUrl = null; // Hakuna profile pic
        }

        // 4️⃣ Pata info za user
        let contact;
        try {
            const v = await sock.onWhatsApp(jid);
            if (v && v[0]?.exists) {
                contact = await sock.getContact(jid);
            }
        } catch {
            contact = null;
        }

        // 5️⃣ Last seen / presence
        let presence = 'Unknown';
        try {
            const pres = await sock.presenceSubscribe(jid);
            const p = await sock.fetchPresence(jid);
            if (p?.lastSeen) presence = new Date(p.lastSeen * 1000).toLocaleString();
        } catch {
            presence = 'Unavailable';
        }

        // 6️⃣ WAID verification (check if exists)
        const waidVerified = contact ? '✅ Exists on WhatsApp' : '❌ Not found';

        // 7️⃣ Status message
        const status = contact?.status?.text || 'No status';

        // 8️⃣ Name
        const name = contact?.name || jid.split('@')[0];

        // 9️⃣ Compile info
        let infoText = `📌 User Info:\n`;
        infoText += `📝 Name: ${name}\n`;
        infoText += `📇 WAID: ${jid} (${waidVerified})\n`;
        infoText += `💬 Status: ${status}\n`;
        infoText += `⏱️ Last Seen: ${presence}\n`;
        infoText += `🔗 JID: ${jid}`;

        // 10️⃣ Tuma profile pic ikiwa ipo
        if (ppUrl) {
            await sock.sendMessage(chatId, {
                image: { url: ppUrl },
                caption: infoText
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: infoText }, { quoted: message });
        }

    } catch (err) {
        console.error('[GETPP] Error:', err);
        await sock.sendMessage(
            chatId,
            { text: '❌ Failed to fetch user info.' },
            { quoted: message }
        );
    }
}

module.exports = getPPCommand;
