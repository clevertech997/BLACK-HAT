const yts = require('yt-search');
const ytdl = require('ytdl-core');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        return await sock.sendMessage(chatId, {
            text: '🔍 Please enter the song name to get the lyrics!\nUsage: *lyrics <song name>*'
        }, { quoted: message });
    }

    try {
        // 🔎 Search YouTube for the song
        const { videos } = await yts(songTitle);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `❌ No video found for "${songTitle}".`
            }, { quoted: message });
        }

        const video = videos[0];
        const url = video.url;
        const thumbnail = video.thumbnail;
        const title = video.title;

        // 📄 Get video info
        const info = await ytdl.getInfo(url);

        // Use description as lyrics (some videos have full lyrics)
        let lyrics = info.videoDetails.description || '';
        lyrics = lyrics.trim();

        if (!lyrics) {
            return await sock.sendMessage(chatId, {
                text: `❌ Could not find lyrics for "${title}".`
            }, { quoted: message });
        }

        // Limit WhatsApp message size
        const maxChars = 4096;
        if (lyrics.length > maxChars) {
            lyrics = lyrics.slice(0, maxChars - 3) + '...';
        }

        // Send lyrics with thumbnail and title
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 *${title}*\n\n${lyrics}`
        }, { quoted: message });

    } catch (error) {
        console.error('[LYRICS COMMAND ERROR]', error);
        await sock.sendMessage(chatId, {
            text: `❌ An error occurred while fetching lyrics for "${songTitle}".`
        }, { quoted: message });
    }
}

module.exports = { lyricsCommand };
