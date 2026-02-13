const fs = require('fs').promises;
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'messageCount.json');

/**
 * Load message counts from JSON file safely
 * @returns {Promise<Object>}
 */
async function loadMessageCounts() {
    try {
        const data = await fs.readFile(dataFilePath, 'utf-8');
        // Kama faili ni tupu au si JSON halali, rudisha object tupu
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        if (err.code === 'ENOENT') return {}; // Faili halipo
        console.error('Error loading message counts:', err);
        return {}; // Rudisha object tupu kama kuna error nyingine
    }
}

/**
 * Save message counts to JSON file
 * @param {Object} messageCounts
 */
async function saveMessageCounts(messageCounts) {
    try {
        await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
        await fs.writeFile(dataFilePath, JSON.stringify(messageCounts, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error saving message counts:', err);
    }
}

/**
 * Increment message count for a user in a group
 * @param {string} groupId
 * @param {string} userId
 */
async function incrementMessageCount(groupId, userId) {
    const messageCounts = await loadMessageCounts();

    if (!messageCounts[groupId]) messageCounts[groupId] = {};
    if (!messageCounts[groupId][userId]) messageCounts[groupId][userId] = 0;

    messageCounts[groupId][userId] += 1;

    await saveMessageCounts(messageCounts);
}

/**
 * Send top members message to a group
 * @param {Object} sock - WhatsApp socket
 * @param {string} chatId
 * @param {boolean} isGroup
 */
async function topMembers(sock, chatId, isGroup) {
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: 'This command is only available in group chats.' });
        return;
    }

    const messageCounts = await loadMessageCounts();
    const groupCounts = messageCounts[chatId] || {};

    const sortedMembers = Object.entries(groupCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5); // Top 5 members

    if (sortedMembers.length === 0) {
        await sock.sendMessage(chatId, { text: 'No message activity recorded yet.' });
        return;
    }

    let message = '🏆 Top Members Based on Message Count:\n\n';
    sortedMembers.forEach(([userId, count], index) => {
        message += `${index + 1}. @${userId.split('@')[0]} - ${count} messages\n`;
    });

    await sock.sendMessage(chatId, {
        text: message,
        mentions: sortedMembers.map(([userId]) => userId),
    });
}

module.exports = { incrementMessageCount, topMembers };
