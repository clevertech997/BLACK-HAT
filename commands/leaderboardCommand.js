const { topMembers } = require('../lib/messageCountHelper');

async function leaderboardCommand(sock, chatId, message) {
    try {
        const body =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        // Default type
        let type = 'total';

        const args = body.trim().split(/\s+/);
        if (args.length > 1) {
            const t = args[1].toLowerCase();
            if (['daily','weekly','monthly','total'].includes(t)) {
                type = t;
            }
        }

        await topMembers(sock, chatId, true, type);

    } catch (err) {
        console.error('[Leaderboard] Error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to fetch leaderboard. Try again later.'
        }, { quoted: message });
    }
}

module.exports = leaderboardCommand;
