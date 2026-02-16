const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

async function playCommand(sock, chatId, message) {
    try {

        const text = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text;

        if (!text) return;

        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "❌ Please provide a song name.\nExample: play imagine dragons"
            }, { quoted: message });
        }

        // 🔍 Search YouTube
        const search = await yts(query);

        if (!search.videos.length) {
            return await sock.sendMessage(chatId, {
                text: `❌ No results found for: ${query}`
            }, { quoted: message });
        }

        const video = search.videos[0];

        // Validate URL
        if (!ytdl.validateURL(video.url)) {
            return await sock.sendMessage(chatId, {
                text: "❌ Invalid YouTube URL."
            }, { quoted: message });
        }

        const title = video.title.replace(/[<>:"/\\|?*]+/g, '');
        const thumbnail = video.thumbnail;
        const duration = video.timestamp;
        const views = video.views?.toLocaleString() || "Unknown";
        const author = video.author?.name || "Unknown";

        // 📸 Send thumbnail + info
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption:
`🎵 *${title}*

👤 Channel: ${author}
⏱ Duration: ${duration}
👁 Views: ${views}

⬇️ Downloading audio...`
        }, { quoted: message });

        // 📁 Create download folder if not exists
        const downloadDir = path.join(__dirname, '../downloads');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir);
        }

        const filePath = path.join(downloadDir, `${Date.now()}.mp3`);

        // 🎧 Download audio stream
        const audioStream = ytdl(video.url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        });

        const writeStream = fs.createWriteStream(filePath);
        audioStream.pipe(writeStream);

        // 📊 Real download progress (console only)
        audioStream.on('progress', (chunkLength, downloaded, total) => {
            const percent = ((downloaded / total) * 100).toFixed(2);
            console.log(`Downloading ${title}: ${percent}%`);
        });

        writeStream.on('finish', async () => {
            try {
                await sock.sendMessage(chatId, {
                    audio: { url: filePath },
                    mimetype: 'audio/mpeg',
                    fileName: `${title}.mp3`
                }, { quoted: message });

                fs.unlinkSync(filePath); // delete after sending

            } catch (err) {
                console.error("Send error:", err);
                await sock.sendMessage(chatId, {
                    text: "❌ Failed to send audio file."
                }, { quoted: message });
            }
        });

        audioStream.on('error', async (err) => {
            console.error("Download error:", err);
            await sock.sendMessage(chatId, {
                text: "❌ Download failed."
            }, { quoted: message });
        });

    } catch (err) {
        console.error("System error:", err);
        await sock.sendMessage(chatId, {
            text: "❌ An unexpected system error occurred."
        }, { quoted: message });
    }
}

module.exports = playCommand;
