const fs = require('fs');

async function dpCommand(sock, chatId, message, numberOrMention) {
    try {
        // Resolve JID from mention or number
        let jid = '';
        if (!numberOrMention) {
            jid = message.key.participant || chatId; // default to sender or group
        } else if (numberOrMention.includes('@')) {
            jid = numberOrMention;
        } else {
            jid = `${numberOrMention.replace(/\D/g, '')}@s.whatsapp.net`;
        }

        // Optional size (small, medium, large) - default large
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(/\s+/);
        const sizeArg = args[2]?.toLowerCase() || 'large';
        const validSizes = ['small', 'medium', 'large'];
        const size = validSizes.includes(sizeArg) ? sizeArg : 'large';

        // Fetch profile picture
        let url;
        try {
            url = await sock.profilePictureUrl(jid, 'image');
        } catch {
            return await sock.sendMessage(chatId, {
                text: '❌ Cannot fetch DP. User may not have a profile picture or is private.'
            }, { quoted: message });
        }

        // Build caption
        const caption = `📥 *Profile Picture Downloaded*\n\n👤 User: @${jid.split('@')[0]}\n🖼 Size: ${size.charAt(0).toUpperCase() + size.slice(1)}`;

        // Send image
        await sock.sendMessage(chatId, {
            image: { url },
            caption,
            mentions: [jid]
        }, { quoted: message });

    } catch (err) {
        console.error('[DP COMMAND ERROR]', err);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to fetch DP. Please try again later.'
        }, { quoted: message });
    }
}

module.exports = dpCommand;
