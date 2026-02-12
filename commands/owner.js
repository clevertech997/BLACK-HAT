const settings = require('../settings');

/**
 * Send bot owner's contact as a vCard (WhatsApp compatible)
 * @param {import('@whiskeysockets/baileys').WAConnection} sock - WhatsApp socket
 * @param {string} chatId - Chat ID to send the vCard
 */
async function ownerCommand(sock, chatId) {
    const { botOwner, ownerNumber } = settings;

    // Hakikisha namba ni digits tu (WhatsApp inahitaji)
    const cleanNumber = ownerNumber.replace(/\D/g, '');

    // Tayarisha vCard compatible na WhatsApp
    const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${botOwner}
ORG:Bot Owner;
TEL;type=CELL;waid=${cleanNumber}:${cleanNumber}
END:VCARD
`.trim();

    // Tuma message ya contact
    await sock.sendMessage(chatId, {
        contacts: {
            displayName: botOwner,
            contacts: [{ vcard }],
        },
    });
}

module.exports = ownerCommand;
