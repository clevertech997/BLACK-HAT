const settings = require('../settings');

async function getPPCommand(sock, chatId, message) {
    try {
        const sender = message.key.participant || message.key.remoteJid;

        // 🔒 Private mode check
        if (settings.commandMode === "private" && sender !== settings.ownerNumber + '@s.whatsapp.net') {
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
                            message.message?.extendedTextMessage?.text?.trim() || '';
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
            ppUrl = null;
        }

        // 4️⃣ Pata info za user
        let contact = null;
        let userType = 'Individual';
        let extraInfo = '';
        try {
            const exists = await sock.onWhatsApp(jid);
            if (exists && exists[0]?.exists) contact = await sock.getContact(jid);

            if (contact?.isBusiness) {
                userType = 'Business';
                extraInfo = `🏢 Business Name: ${contact.business?.name || 'N/A'}\n⚡ Description: ${contact.business?.description || 'N/A'}`;
            }

            if (jid.endsWith('@g.us')) {
                userType = 'Group';
                try {
                    const groupMeta = await sock.groupMetadata(jid);
                    extraInfo = `👥 Members: ${groupMeta.participants.length}\n🔥 Subject: ${groupMeta.subject}`;
                } catch {
                    extraInfo = '👥 Members info unavailable';
                }
            }
        } catch {
            contact = null;
        }

        // 5️⃣ Last seen / presence
        let presence = '❓ Unknown';
        try {
            const p = await sock.fetchPresence(jid);
            if (p?.lastSeen) presence = `⏱️ ${new Date(p.lastSeen * 1000).toLocaleString()} ⚡`;
            else if (p?.presence) presence = p.presence === 'online' ? '🟢 Online 🔥' : '⚪ Offline 💀';
        } catch {
            presence = '❌ Unavailable ⚡';
        }

        // 6️⃣ WAID verification
        const waidVerified = contact ? '✅ Exists on WhatsApp ⚡' : '❌ Not found 💀';

        // 7️⃣ Status message
        const status = contact?.status?.text || 'No status 🔥';

        // 8️⃣ Name
        const name = contact?.name || jid.split('@')[0];

        // 9️⃣ Compile info in full hacker style with extra emojis
        const infoText = 
`╭─❮ *💀🖤 HACKER INFO 🖤💀* ❯─╮
│📝 Name       : ${name} ⚡
│📇 WAID       : ${jid} (${waidVerified})
│💬 Status     : ${status}
│🕵️ Type       : ${userType} 🔥
│⏱️ Last Seen  : ${presence}
${extraInfo ? '│' + extraInfo.replace(/\n/g, '\n│') : ''}
│🔗 JID        : ${jid} 💀
╰────────────────────────╯`;

        // 🔟 Tuma profile pic ikiwa ipo
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
            { text: '❌ Failed to fetch user info 💀.' },
            { quoted: message }
        );
    }
}

module.exports = getPPCommand;
