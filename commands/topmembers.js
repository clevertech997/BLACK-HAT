const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const totalFilePath = path.join(dataDir, 'messageCount.json');
const dailyFilePath = path.join(dataDir, 'dailyMessageCount.json');
const weeklyFilePath = path.join(dataDir, 'weeklyMessageCount.json');
const monthlyFilePath = path.join(dataDir, 'monthlyMessageCount.json');

/** Helper: load JSON */
async function loadJson(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        console.error(`[MessageCount] Error loading ${filePath}:`, err);
        return {};
    }
}

/** Helper: save JSON */
async function saveJson(filePath, data) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error(`[MessageCount] Error saving ${filePath}:`, err);
    }
}

/** Increment message counts (total + daily + weekly + monthly) */
async function incrementMessageCount(groupId, userId) {
    const today = new Date();
    const isoDay = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const isoWeek = `${today.getFullYear()}-W${getWeekNumber(today)}`;
    const isoMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    try {
        // Total
        const totalCounts = await loadJson(totalFilePath);
        totalCounts[groupId] = totalCounts[groupId] || {};
        totalCounts[groupId][userId] = (totalCounts[groupId][userId] || 0) + 1;
        await saveJson(totalFilePath, totalCounts);

        // Daily
        const dailyCounts = await loadJson(dailyFilePath);
        dailyCounts[groupId] = dailyCounts[groupId] || {};
        dailyCounts[groupId][isoDay] = dailyCounts[groupId][isoDay] || {};
        dailyCounts[groupId][isoDay][userId] = (dailyCounts[groupId][isoDay][userId] || 0) + 1;
        await saveJson(dailyFilePath, dailyCounts);

        // Weekly
        const weeklyCounts = await loadJson(weeklyFilePath);
        weeklyCounts[groupId] = weeklyCounts[groupId] || {};
        weeklyCounts[groupId][isoWeek] = weeklyCounts[groupId][isoWeek] || {};
        weeklyCounts[groupId][isoWeek][userId] = (weeklyCounts[groupId][isoWeek][userId] || 0) + 1;
        await saveJson(weeklyFilePath, weeklyCounts);

        // Monthly
        const monthlyCounts = await loadJson(monthlyFilePath);
        monthlyCounts[groupId] = monthlyCounts[groupId] || {};
        monthlyCounts[groupId][isoMonth] = monthlyCounts[groupId][isoMonth] || {};
        monthlyCounts[groupId][isoMonth][userId] = (monthlyCounts[groupId][isoMonth][userId] || 0) + 1;
        await saveJson(monthlyFilePath, monthlyCounts);

    } catch (err) {
        console.error(`[MessageCount] Failed to increment message count for ${userId} in ${groupId}:`, err);
    }
}

/** Get week number helper */
function getWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

/**
 * Send top members
 * @param {Object} sock - WhatsApp socket
 * @param {string} chatId
 * @param {boolean} isGroup
 * @param {'daily'|'weekly'|'monthly'|'total'} type
 */
async function topMembers(sock, chatId, isGroup, type = 'total') {
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: '❌ This command is only available in group chats.' });
        return;
    }

    let counts = {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;

    try {
        if (type === 'daily') {
            counts = (await loadJson(dailyFilePath))[chatId]?.[today] || {};
        } else if (type === 'weekly') {
            counts = (await loadJson(weeklyFilePath))[chatId]?.[week] || {};
        } else if (type === 'monthly') {
            counts = (await loadJson(monthlyFilePath))[chatId]?.[month] || {};
        } else {
            counts = (await loadJson(totalFilePath))[chatId] || {};
        }

        const sortedMembers = Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        if (!sortedMembers.length) {
            await sock.sendMessage(chatId, { text: 'ℹ️ No activity recorded yet.' });
            return;
        }

        let messageTitle = {
            daily: "🏆 Today's Top Members:",
            weekly: "🏆 This Week's Top Members:",
            monthly: "🏆 This Month's Top Members:",
            total: "🏆 All-Time Top Members:"
        };

        let message = `${messageTitle[type]}\n\n`;
        sortedMembers.forEach(([userId, count], index) => {
            message += `${index + 1}. @${userId.split('@')[0]} - ${count} messages\n`;
        });

        await sock.sendMessage(chatId, {
            text: message,
            mentions: sortedMembers.map(([userId]) => userId),
        });
    } catch (err) {
        console.error('[MessageCount] Failed to send top members:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch top members. Try again later.' });
    }
}

/** Reset daily, weekly, monthly counts (manual or cron) */
async function resetCounts(type = 'daily') {
    try {
        if (type === 'daily') await saveJson(dailyFilePath, {});
        else if (type === 'weekly') await saveJson(weeklyFilePath, {});
        else if (type === 'monthly') await saveJson(monthlyFilePath, {});
        console.log(`[MessageCount] ${type} message counts reset.`);
    } catch (err) {
        console.error(`[MessageCount] Failed to reset ${type} counts:`, err);
    }
}

module.exports = {
    incrementMessageCount,
    topMembers,
    resetCounts
};
