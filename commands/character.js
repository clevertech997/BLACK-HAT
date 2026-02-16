const { channelInfo } = require('../lib/messageConfig');

async function characterCommand(sock, chatId, message, groupMetadata) {
    try {
        let userJid;
        const ctx = message.message?.extendedTextMessage?.contextInfo;

        // 1️⃣ Determine user
        if (ctx?.mentionedJid?.length > 0) userJid = ctx.mentionedJid[0];
        else if (ctx?.participant) userJid = ctx.participant;
        else userJid = message.key.participant || message.key.remoteJid;

        if (!userJid) {
            return await sock.sendMessage(chatId, { text: '❌ Could not determine user.' });
        }

        // 2️⃣ Extract number & wa.me link
        const number = userJid.split('@')[0];
        const waLink = `https://wa.me/${number}`;

        // 3️⃣ Display Name
        let displayName = number;
        try { displayName = await sock.getName(userJid); } catch {}

        // 4️⃣ Profile Picture
        let profilePic = null;
        try { profilePic = await sock.profilePictureUrl(userJid, 'image'); } catch {}

        // 5️⃣ Bio / Status
        let about = 'No bio available';
        try {
            const status = await sock.fetchStatus(userJid);
            about = status?.status || about;
        } catch {}

        // 6️⃣ Online / Last Seen
        let lastSeen = '⚪ Last seen hidden';
        try {
            await sock.presenceSubscribe(userJid);
            lastSeen = "🟢 Online / Recently Active";
        } catch {}

        // 7️⃣ Group Role
        let role = null;
        let roleEmoji = '';
        if (groupMetadata) {
            const participant = groupMetadata.participants.find(p => p.id === userJid);
            if (participant?.admin === 'superadmin') { role = 'Owner'; roleEmoji = '👑'; }
            else if (participant?.admin === 'admin') { role = 'Admin'; roleEmoji = '🛡️'; }
            else { role = 'Member'; roleEmoji = '👤'; }
        }

        // 8️⃣ Build hacker terminal style card
        const dashLine = '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒';
        let msg = '';
        msg += `💻 𝗛𝗔𝗖𝗞𝗘𝗥 𝗧𝗘𝗥𝗠𝗜𝗡𝗔𝗟 💻\n`;
        msg += `${dashLine}\n\n`;

        msg += `> 🆔 Identity\n`;
        msg += `    Name       : ${displayName}\n`;
        msg += `    Number     : +${number}\n`;
        msg += `    JID        : ${userJid}\n`;
        msg += `    WA Link    : 📞 ${waLink}\n\n`;

        msg += `> 💬 Bio / Status\n`;
        msg += `    ${about}\n\n`;

        msg += `> 🛡️ Role & Online Status\n`;
        if (role) msg += `    Role       : ${roleEmoji} ${role}\n`;
        if (lastSeen) msg += `    Status     : ${lastSeen}\n\n`;

        msg += `${dashLine}\n`;
        msg += `⚡ Tip: Send 📩 to message this user directly\n`;
        msg += `💀 Stay anonymous, stay safe!\n`;
        msg += `${dashLine}\n`;

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
