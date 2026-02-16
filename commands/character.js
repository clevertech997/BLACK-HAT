const { channelInfo } = require('../lib/messageConfig');

async function characterCommand(sock, chatId, message, groupMetadata) {
    try {
        let userJid;
        const ctx = message.message?.extendedTextMessage?.contextInfo;

        // Determine user: mention > reply > sender
        if (ctx?.mentionedJid?.length > 0) userJid = ctx.mentionedJid[0];
        else if (ctx?.participant) userJid = ctx.participant;
        else userJid = message.key.participant || message.key.remoteJid;

        if (!userJid) return await sock.sendMessage(chatId, { text: '❌ Could not determine user.' });

        const number = userJid.split('@')[0];

        let displayName = number;
        try { displayName = await sock.getName(userJid); } catch {}

        let profilePic = null;
        try { profilePic = await sock.profilePictureUrl(userJid, 'image'); } catch {}

        let about = null;
        try {
            const status = await sock.fetchStatus(userJid);
            if (status?.status) about = status.status;
        } catch {}

        let lastSeen = null;
        try {
            await sock.presenceSubscribe(userJid);
            lastSeen = "🟢 Online / Recently Active";
        } catch { lastSeen = "⚪ Last seen hidden"; }

        // Role + extra group info
        let role = null;
        let roleEmoji = '';
        let joinDate = null;
        let isActive = false;

        if (groupMetadata) {
            const participant = groupMetadata.participants.find(p => p.id === userJid);
            if (participant) {
                isActive = true;
                joinDate = participant?.joinedAt ? new Date(participant.joinedAt).toLocaleDateString() : null;
                if (participant.admin === 'superadmin') { role = 'Owner'; roleEmoji = '👑'; }
                else if (participant.admin === 'admin') { role = 'Admin'; roleEmoji = '🛡️'; }
                else { role = 'Member'; roleEmoji = '👤'; }
            }
        }

        // Fancy hacker-style borders
        const topBorder = `━❮ ⚡ 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 SCAN ⚡ ❯━┈⊷`;
        const bottomBorder = `╰━━━━━━━━━━━━⪼`;
        const separator = `║ ──────────────────────────────`;

        let msg = '';
        msg += `${topBorder}\n`;
        msg += `║ 👤 Name      : ${displayName}\n${separator}\n`;
        msg += `║ 📞 Number    : +${number}\n${separator}\n`;
        if (about) msg += `║ 💬 About     : ${about}\n${separator}\n`;
        if (role) msg += `║ ${roleEmoji} Role      : ${role}\n${separator}\n`;
        if (joinDate) msg += `║ 📅 Joined    : ${joinDate}\n${separator}\n`;
        msg += `║ ⚡ Active    : ${isActive ? 'Yes' : 'No'}\n${separator}\n`;
        if (lastSeen) msg += `║ 🟢 Last Seen : ${lastSeen}\n${separator}\n`;
        msg += `${bottomBorder}\n`;

        // Optional binary rain
        const rainLines = 3;
        for (let i = 0; i < rainLines; i++) {
            let line = '';
            for (let j = 0; j < 30; j++) {
                line += Math.random() > 0.5 ? '0' : '1';
            }
            msg += `${line}\n`;
        }

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
