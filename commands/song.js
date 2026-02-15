const yts = require('yt-search');
const ytdl = require('ytdl-core');

const cooldown = new Map();
const dailyUsage = new Map();

const COOLDOWN_TIME = 10000; // 10 sec
const DAILY_LIMIT_FREE = 5;

const OWNER_NUMBER = "2557XXXXXXXX"; // weka namba yako
const premiumUsers = new Set([
    "2557XXXXXXXX@s.whatsapp.net"
]);

function isOwner(senderId) {
    return senderId.startsWith(OWNER_NUMBER);
}

function isPremium(senderId) {
    return premiumUsers.has(senderId);
}

function checkDailyLimit(senderId) {
    const today = new Date().toDateString();

    if (!dailyUsage.has(senderId)) {
        dailyUsage.set(senderId, { date: today, count: 0 });
    }

    const data = dailyUsage.get(senderId);

    if (data.date !== today) {
        data.date = today;
        data.count = 0;
    }

    return data;
}

async function songCommand(sock, chatId, message, senderId, isGroup) {
    try {
        const body =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!body.toLowerCase().startsWith('.song')) return;

        const query = body.replace('.song', '').trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Usage: .song <song name>'
            }, { quoted: message });
        }

        // 🚫 Group Only Mode (optional)
        if (!isGroup) {
            return sock.sendMessage(chatId, {
                text: '❌ This command works in groups only.'
            }, { quoted: message });
        }

        // 🚫 Cooldown
        if (cooldown.has(senderId)) {
            const expire = cooldown.get(senderId);
            if (Date.now() < expire) {
                const left = Math.ceil((expire - Date.now()) / 1000);
                return sock.sendMessage(chatId, {
                    text: `⏳ Wait ${left}s before using again.`
                }, { quoted: message });
            }
        }

        cooldown.set(senderId, Date.now() + COOLDOWN_TIME);

        // 🚫 Daily Limit (Free users only)
        if (!isOwner(senderId) && !isPremium(senderId)) {
            const usage = checkDailyLimit(senderId);

            if (usage.count >= DAILY_LIMIT_FREE) {
                return sock.sendMessage(chatId, {
                    text: '🚫 Daily limit reached (5 songs).\nUpgrade to Premium for unlimited access.'
                }, { quoted: message });
            }

            usage.count++;
        }

        // 🔎 Search
        const search = await yts(query);
        if (!search.videos.length) {
            return sock.sendMessage(chatId, {
                text: '❌ No song found.'
            }, { quoted: message });
        }

        const video = search.videos[0];

        if (video.seconds > 900) {
            return sock.sendMessage(chatId, {
                text: '❌ Song too long. Max 15 minutes.'
            }, { quoted: message });
        }

        const title = video.title.replace(/[<>:"/\\|?*]+/g, '');
        const url = video.url;

        // 🎚 Quality Logic
        let quality = 'highestaudio';
        let label = '128kbps';

        if (isOwner(senderId) || isPremium(senderId)) {
            label = '320kbps';
        }

        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption:
`🎵 *PREMIUM MUSIC SYSTEM*

📌 Title: ${title}
⏱ Duration: ${video.timestamp}
🎧 Quality: ${label}

⬇️ Processing...`
        }, { quoted: message });

        const info = await ytdl.getInfo(url);

        let format = ytdl.chooseFormat(info.formats, {
            quality: quality,
            filter: 'audioonly'
        });

        if (!format) {
            format = ytdl.chooseFormat(info.formats, {
                quality: 'highestaudio',
                filter: 'audioonly'
            });
        }

        if (!format) {
            return sock.sendMessage(chatId, {
                text: '❌ Failed to fetch audio.'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            audio: { url: format.url },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            caption: `✅ Download complete`
        }, { quoted: message });

    } catch (err) {
        console.error('[PREMIUM SONG ERROR]', err);
        await sock.sendMessage(chatId, {
            text: '❌ Download failed.'
        }, { quoted: message });
    }
}

module.exports = songCommand;
