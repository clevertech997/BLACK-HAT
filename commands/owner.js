const settings = require('../settings');

/**
 * Send bot owner's contact as a vCard (WhatsApp compatible)
 * @param {import('@whiskeysockets/baileys').WAConnection} sock - WhatsApp socket
 * @param {string} chatId - Chat ID to send the vCard
 */
async function ownerCommand(sock, chatId) {
    try {
        let { botOwner, ownerNumber } = settings;

        // Support kwa multiple owners: kama ni array, tumia yote
        if (!Array.isArray(ownerNumber)) ownerNumber = [ownerNumber];
        if (!Array.isArray(botOwner)) botOwner = [botOwner];

        const contactsArray = ownerNumber.map((num, idx) => {
            const cleanNumber = String(num).replace(/\D/g, ''); // Remove any non-digit chars
            const displayName = botOwner[idx] || 'Bot Owner';

            const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${displayName}
ORG:Bot Owner;
TEL;type=CELL;waid=${cleanNumber}:${cleanNumber}
END:VCARD
`.trim();

            return { vcard };
        });

        await sock.sendMessage(chatId, {
            contacts: {
                displayName: botOwner.join(', '),
                contacts: contactsArray,
            },
        });
    } catch (err) {
        console.error('Error sending owner contact:', err);
        await sock.sendMessage(chatId, { text: '❌ Tatizo ku-send contact ya owner.' });
    }
}

module.exports = ownerCommand;
