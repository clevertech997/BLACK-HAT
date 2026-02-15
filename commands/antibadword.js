const { handleAntiBadwordCommand } = require('../lib/antibadword');
const isAdminHelper = require('../lib/isAdmin');

async function antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        // Check if sender is admin
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ *For Group Admins Only!*' 
            }, { quoted: message });
            return;
        }

        // Extract command arguments (after .antibadword)
        const rawText = message.message?.conversation ||
                        message.message?.extendedTextMessage?.text || '';
        const args = rawText.split(' ').slice(1).join(' ').trim();

        if (!args) {
            const usageText = `
⚙️ *Usage of .antibadword*
.add <word>    - Add a bad word
.del <word>    - Remove a bad word
.list          - List all bad words in this group
`;
            await sock.sendMessage(chatId, { text: usageText }, { quoted: message });
            return;
        }

        // Call the main handler
        await handleAntiBadwordCommand(sock, chatId, message, args);

    } catch (error) {
        console.error('[ANTIBADWORD CMD] Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ *Error processing antibadword command*' 
        }, { quoted: message });
    }
}

module.exports = antibadwordCommand;
