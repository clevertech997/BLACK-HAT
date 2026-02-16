const settings = require('../settings');

async function ownerCommand(sock, chatId) {
    try {
        const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${settings.botOwner}
TEL;waid=${settings.ownerNumber}:${settings.ownerNumber}
END:VCARD
`;

        // Buttons
        const buttons = [
            { buttonId: `messageOwner`, buttonText: { displayText: '💬 Message Owner' }, type: 1 },
            { buttonUrl: 'https://whatsapp.com/channel/0029Vb73SRl1CYoLWtyr4u1X', buttonText: { displayText: '📺 Join Channel' }, type: 2 }
        ];

        const buttonMessage = {
            contacts: { displayName: settings.botOwner, contacts: [{ vcard }] },
            caption: `🤖 *${settings.botName || 'BLACK HAT'}*\nContact the owner or join the channel for updates!`,
            footer: '𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻',
            buttons,
            headerType: 1
        };

        await sock.sendMessage(chatId, buttonMessage);

    } catch (error) {
        console.error('Error sending owner contact:', error);
        await sock.sendMessage(chatId, { text: '❌ Could not fetch owner contact right now.' });
    }
}

module.exports = ownerCommand;
