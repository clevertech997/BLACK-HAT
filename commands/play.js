const yts = require('yt-search');
const ytdl = require('ytdl-core');
const axios = require('axios');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: "🎵 Andika jina la wimbo.\nMfano: .play snokono"
            }, { quoted: message });
        }

        // STEP 1: Searching
        const progressMsg = await sock.sendMessage(chatId, {
            text: "🔎 Searching song..."
        }, { quoted: message });

        const search = await yts(searchQuery);

        if (!search.videos.length) {
            return await sock.sendMessage(chatId, {
                text: "❌ Song not found!"
            }, { quoted: message });
        }

        const video = search.videos[0];

        // STEP 2: Info Message
        await sock.sendMessage(chatId, {
            text:
`🎧 *SONG FOUND*

📌 Title: ${video.title}
⏱ Duration: ${video.timestamp}
👤 Channel: ${video.author.name}
👀 Views: ${video.views.toLocaleString()}

⬇️ Downloading audio...`
        }, { quoted: progressMsg });

        // STEP 3: Get thumbnail
        let thumbBuffer;
        try {
            const thumb = await axios.get(video.thumbnail, { responseType: "arraybuffer" });
            thumbBuffer = thumb.data;
        } catch {
            thumbBuffer = null;
        }

        // STEP 4: Download stream
        const stream = ytdl(video.url, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });

        // STEP 5: Uploading notice
        await sock.sendMessage(chatId, {
            text: "📤 Uploading song..."
        }, { quoted: message });

        // STEP 6: Send audio
        await sock.sendMessage(chatId, {
            audio: stream,
            mimetype: "audio/mpeg",
            fileName: `${video.title}.mp3`,
            contextInfo: thumbBuffer ? {
                externalAdReply: {
                    title: video.title,
                    body: video.author.name,
                    thumbnail: thumbBuffer,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            } : {}
        }, { quoted: message });

        // STEP 7: Done
        await sock.sendMessage(chatId, {
            text: `✅ Download complete\n🎵 *${video.title}*`
        }, { quoted: message });

    } catch (error) {
        console.error("Play command error:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Download failed. Try again later."
        }, { quoted: message });
    }
}

module.exports = playCommand;
