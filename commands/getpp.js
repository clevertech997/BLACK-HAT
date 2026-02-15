// getPP.js
const isOwnerOrSudo = require('../lib/isOwner');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

async function getppCommand(sock, chatId, message) {
    try {
        if (!message?.message) return;

        const sender = message.key.participant || message.key.remoteJid;

        // 🔐 Owner / Sudo Only
        const allowed = await isOwnerOrSudo(sender, sock, chatId);
        if (!allowed) {
            return await sock.sendMessage(
                chatId,
                { text: '🚫 OWNER ONLY COMMAND' },
                { quoted: message }
            );
        }

        let jid;

        // ✅ Reply target
        const replyUser =
            message.message?.extendedTextMessage?.contextInfo?.participant;

        if (replyUser) {
            jid = replyUser;
        } else {
            const text =
                message.message?.conversation ||
                message.message?.extendedTextMessage?.text ||
                '';

            const args = text.trim().split(/\s+/).slice(1);

            if (!args[0]) {
                return await sock.sendMessage(
                    chatId,
                    {
                        text:
                            '⚠️ Usage:\n.getpp <number>\nOR reply to user with .getpp'
                    },
                    { quoted: message }
                );
            }

            const number = args[0].replace(/[^0-9]/g, '');
            if (number.length < 7) {
                return await sock.sendMessage(
                    chatId,
                    { text: '❌ Invalid number format.' },
                    { quoted: message }
                );
            }

            jid = `${number}@s.whatsapp.net`;
        }

        // ✅ Check WhatsApp registration
        const check = await sock.onWhatsApp(jid);
        if (!check?.[0]?.exists) {
            return await sock.sendMessage(
                chatId,
                { text: '❌ Number not registered on WhatsApp.' },
                { quoted: message }
            );
        }

        const numberOnly = jid.split('@')[0];

        // 🔥 PROFESSIONAL COUNTRY DETECTION
        let country = "Unknown 🌍";
        let countryCode = "";
        let formattedInternational = numberOnly;

        try {
            const phoneNumber = parsePhoneNumberFromString("+" + numberOnly);

            if (phoneNumber) {
                country = phoneNumber.country || "Unknown";
                countryCode = phoneNumber.countryCallingCode;
                formattedInternational = phoneNumber.formatInternational();
            }
        } catch {}

        // ✅ Profile Picture
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(jid, 'image');
        } catch {
            ppUrl = null;
        }

        // ✅ Bio
        let bio = "No bio";
        try {
            const status = await sock.fetchStatus(jid);
            bio = status?.status || "No bio";
        } catch {}

        // ✅ Final Info
        const infoText = `
╭───「 _PROFESSIONAL USER SCAN_ 」───⬣
│📱 Number        : ${formattedInternational}
│🌍 Country       : ${country}
│☎️ Calling Code  : +${countryCode || "-"}
│💬 Bio           : ${bio}
│🆔 WA ID         : ${jid}
╰────────────────────────⬣
        `.trim();

        // ✅ Send
        if (ppUrl) {
            await sock.sendMessage(
                chatId,
                { image: { url: ppUrl }, caption: infoText },
                { quoted: message }
            );
        } else {
            await sock.sendMessage(
                chatId,
                { text: infoText + '\n\n(No profile picture found)' },
                { quoted: message }
            );
        }

    } catch (err) {
        console.error('[GETPP ERROR]', err);

        if (chatId) {
            await sock.sendMessage(
                chatId,
                { text: '❌ Failed to fetch profile info.' },
                { quoted: message }
            );
        }
    }
}

module.exports = getppCommand;
