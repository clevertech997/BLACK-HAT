const settings = require('../settings');
const { isSudo } = require('./index');

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    try {
        // Clean owner IDs once
        const ownerJid = settings.ownerNumber + "@s.whatsapp.net";
        const ownerNumberClean = settings.ownerNumber.split(':')[0].split('@')[0];

        // Clean sender ID once
        const senderIdClean = senderId.split(':')[0].split('@')[0];
        const senderLidNumeric = senderId.includes('@lid') ? senderId.split('@')[0].split(':')[0] : '';

        // 1️⃣ Direct owner match
        if (senderId === ownerJid || senderIdClean === ownerNumberClean) return true;

        // 2️⃣ Group LID check if sock & chatId provided
        if (sock && chatId && chatId.endsWith('@g.us') && senderId.includes('@lid')) {
            const botLid = sock.user?.lid || '';
            const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);

            // Early exit if sender's LID matches bot's LID
            if (senderLidNumeric && botLidNumeric && senderLidNumeric === botLidNumeric) return true;

            try {
                const metadata = await sock.groupMetadata(chatId);
                const participants = metadata.participants || [];

                // Precompute owner and sender data
                const ownerData = new Set([ownerJid, ownerNumberClean]);
                const senderData = new Set([senderId, senderIdClean, senderLidNumeric]);

                // Loop efficiently, exit early on first match
                for (const p of participants) {
                    const pIdClean = (p.id || '').split(':')[0].split('@')[0];
                    const pLidNumeric = (p.lid || '').split(/[:@]/)[0];

                    if ([p.id, p.lid].some(x => senderData.has(x)) ||
                        senderData.has(pIdClean) ||
                        senderData.has(pLidNumeric) ||
                        ownerData.has(pIdClean)
                    ) {
                        return true;
                    }
                }
            } catch (e) {
                console.error('❌ [isOwnerOrSudo] Group metadata error:', e);
            }
        }

        // 3️⃣ Fallback: check if sender contains owner number
        if (senderId.includes(ownerNumberClean)) return true;

        // 4️⃣ Sudo check
        return await isSudo(senderId);

    } catch (err) {
        console.error('❌ [isOwnerOrSudo] Unexpected error:', err);
        return false;
    }
}

module.exports = isOwnerOrSudo;
