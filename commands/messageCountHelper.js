const fs = require('fs').promises;
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'messageCount.json');

/**
 * Load message counts from JSON file
 */
async function loadMessageCounts() {
    try {
        const data = await fs.readFile(dataFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        console.error('Error loading message counts:', err);
        return {};
    }
}

/**
 * Save message counts to JSON file
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
 * Increment message count for a user
 */
async function incrementMessageCount(groupId, userId) {
    const counts = await loadMessageCounts();
    const now = new Date();

    if (!counts[groupId]) counts[groupId] = {};
    if (!counts[groupId][userId]) counts[groupId][userId] = {
        daily: 0,
        weekly: 0,
        monthly: 0,
        total: 0,
        lastUpdate: now.toISOString()
    };

    const user = counts[groupId][userId];

    // Reset daily/weekly/monthly if period changed
    const last = new Date(user.lastUpdate);

    // Daily reset
    if (last.toDateString() !== now.toDateString()) user.daily = 0;

    // Weekly reset (week starts on Sunday)
    const getWeek = d => {
        const firstDay = new Date(d.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((d - firstDay) / (24*60*60*1000));
        return Math.ceil((dayOfYear + firstDay.getDay()+1)/7);
    };
    if (getWeek(last) !== getWeek(now)) user.weekly = 0;

    // Monthly reset
    if (last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear()) user.monthly = 0;

    // Increment counters
    user.daily += 1;
    user.weekly += 1;
    user.monthly += 1;
    user.total += 1;
    user.lastUpdate = now.toISOString();

    await saveMessageCounts(counts);
}

/**
 * Generate top members message
 */
async function topMembers(sock, chatId, isGroup, type = 'total') {
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: 'This command is only available in group chats.' });
        return;
    }

    const counts = await loadMessageCounts();
    const groupCounts = counts[chatId] || {};

    const sorted = Object.entries(groupCounts)
        .sort(([, a], [, b]) => (b[type] || 0) - (a[type] || 0))
        .slice(0, 10); // Top 10

    if (!sorted.length) {
        await sock.sendMessage(chatId, { text: 'No messages recorded yet.' });
        return;
    }

    let message = `🏆 Top ${sorted.length} Members (${type})\n\n`;
    const emojis = ['🥇','🥈','🥉'];

    sorted.forEach(([userId, data], idx) => {
        const emoji = emojis[idx] || '🔹';
        message += `${emoji} @${userId.split('@')[0]} - ${data[type]} messages\n`;
    });

    await sock.sendMessage(chatId, {
        text: message,
        mentions: sorted.map(([userId]) => userId)
    });
}

module.exports = { incrementMessageCount, topMembers };
