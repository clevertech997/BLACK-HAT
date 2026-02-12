async function getPPCommand(sock, chatId, message) {
    try {
        let jid;

        // 1️⃣ Check if user replied to someone
        if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            jid = message.message.extendedTextMessage.contextInfo.participant;
        } else {
            // 2️⃣ Else, get number from text
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

        // Get profile picture URL
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(jid, 'image');
        } catch {
            return await sock.sendMessage(
                chatId,
                { text: '❌ No profile picture found for this user.' },
                { quoted: message }
            );
        }

        // Send profile picture
        await sock.sendMessage(chatId, {
            image: { url: ppUrl },
            caption: `📌 Profile picture of ${jid.split('@')[0]}`
        }, { quoted: message });

    } catch (err) {
        console.error('[GETPP] Error:', err);
        await sock.sendMessage(
            chatId,
            { text: '❌ Failed to fetch profile picture.' },
            { quoted: message }
        );
    }
}

module.exports = getPPCommand;
