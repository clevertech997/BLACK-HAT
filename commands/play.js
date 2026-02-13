const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';

        const searchQuery = text.split(" ").slice(1).join(" ").trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "⚠️ Usage: .play <song name>"
            }, { quoted: message });
        }

        const { videos } = await yts(searchQuery);

        if (!videos.length) {
            return await sock.sendMessage(chatId, { 
                text: "❌ No song found."
            }, { quoted: message });
        }

        const video = videos[0];
        const urlYt = video.url;
        const title = video.title.replace(/[<>:"/\\|?*]+/g, '');

        await sock.sendMessage(chatId, {
            text: "🎵 Downloading audio..."
        }, { quoted: message });

        const filePath = path.join(__dirname, '../temp', `${Date.now()}.mp3`);

        const stream = ytdl(urlYt, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });

        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(filePath),
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });

        fs.unlinkSync(filePath);

    } catch (err) {
        console.log("[PLAY ERROR]", err);
        await sock.sendMessage(chatId, { 
            text: "❌ Download failed. Try again."
        }, { quoted: message });
    }
}

module.exports = playCommand;
