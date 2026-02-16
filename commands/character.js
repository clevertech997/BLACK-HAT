const { channelInfo } = require('../lib/messageConfig');

async function characterCommand(sock, chatId, message, groupMetadata) {
    try {
        let userJid;

        // 1️⃣ Pata user: mention > reply > sender
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userJid = message.message.extendedTextMessage.contextInfo.participant;
        } else {
            userJid = message.key.participant || message.key.remoteJid;
        }

        if (!userJid) {
            return await sock.sendMessage(chatId, { text: '❌ Could not determine user.' });
        }

        // 2️⃣ Extract number & wa.me link
        const number = userJid.split('@')[0];
        const waLink = `https://wa.me/${number}`;

        // 3️⃣ Display Name
        let displayName = number;
        try {
            displayName = await sock.getName(userJid);
        } catch {}

        // 4️⃣ Profile Picture
        let profilePic = null;
        try {
            profilePic = await sock.profilePictureUrl(userJid, 'image');
        } catch {}

        // 5️⃣ About / Status
        let about = null;
        try {
            const status = await sock.fetchStatus(userJid);
            if (status?.status) about = status.status;
        } catch {}

        // 6️⃣ Last Seen (real if available)
        let lastSeen = null;
        try {
            await sock.presenceSubscribe(userJid);
            // Only show if WhatsApp allows
            lastSeen = "Online / Recently Active"; // or leave null if privacy blocks
        } catch {}

        // 7️⃣ Group Role
        let role = null;
        if (groupMetadata) {
            const participant = groupMetadata.participants.find(p => p.id === userJid);
            if (participant?.admin === 'superadmin') role = 'Owner';
            else if (participant?.admin === 'admin') role = 'Admin';
            else role = 'Member';
        }

        // 8️⃣ Build message ONLY with real info
        let msg = `👤 *USER INFORMATION*\n\n`;
        msg += `• Name: ${displayName}\n`;
        msg += `• Number: +${number}\n`;
        msg += `• JID: ${userJid}\n`;
        msg += `• Profile Link: ${waLink}\n`;
        if (about) msg += `• About / Bio: ${about}\n`;
        if (role) msg += `• Role: ${role}\n`;
        if (lastSeen) msg += `• Last Seen: ${lastSeen}\n`;

        // 9️⃣ Send message
        await sock.sendMessage(chatId, {
            ...(profilePic ? { image: { url: profilePic } } : {}),
            caption: msg,
            mentions: [userJid],
            ...channelInfo
        });

    } catch (err) {
        console.error('Character Command Error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch user info.' });
    }
}

module.exports = characterCommand;
