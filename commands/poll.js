// poll.js
const polls = {}; // Store active polls: { chatId: { question, options, votes } }

async function pollCommand(sock, chatId, message) {
    try {
        const body =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const commandText = body.split(' ').slice(1).join(' ').trim();

        if (!commandText.includes('|')) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Usage: .poll Question? | Option1 | Option2 | Option3',
            }, { quoted: message });
        }

        const parts = commandText.split('|').map(p => p.trim()).filter(Boolean);

        if (parts.length < 2) {
            return await sock.sendMessage(chatId, {
                text: '❌ You need at least 1 option.\nExample:\n.poll What to watch? | Movie1 | Movie2',
            }, { quoted: message });
        }

        const question = parts[0];
        const options = parts.slice(1);
        const votes = new Array(options.length).fill(0);

        // Save poll
        polls[chatId] = { question, options, votes };

        let pollText = `📊 *${question}*\n\n`;
        options.forEach((opt, i) => {
            pollText += `*${i + 1}.* ${opt}\n`;
        });
        pollText += `\n📝 Reply with option number to vote!`;

        await sock.sendMessage(chatId, { text: pollText }, { quoted: message });

    } catch (err) {
        console.error('Poll command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to create poll.' }, { quoted: message });
    }
}

// Function to handle votes
async function handlePollVote(sock, chatId, message) {
    try {
        if (!polls[chatId]) return; // No active poll

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const voteNum = parseInt(text);
        const poll = polls[chatId];

        if (!voteNum || voteNum < 1 || voteNum > poll.options.length) return;

        // Increment vote
        poll.votes[voteNum - 1] += 1;

        let pollResults = `📊 *Poll Results: ${poll.question}*\n\n`;
        poll.options.forEach((opt, i) => {
            pollResults += `*${i + 1}.* ${opt} - ${poll.votes[i]} votes\n`;
        });

        await sock.sendMessage(chatId, { text: pollResults });

    } catch (err) {
        console.error('Poll vote error:', err);
    }
}

module.exports = {
    pollCommand,
    handlePollVote
};
