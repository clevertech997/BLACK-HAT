const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pump = promisify(pipeline);

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: "🎵 What song do you want to download?"
            }, { quoted: message });
        }

        // 🔎 Search YouTube
        const { videos } = await yts(searchQuery);
        if (!videos.length) {
            return await sock.sendMessage(chatId, {
                text: "❌ No songs found!"
            }, { quoted: message });
        }

        const video = videos[0];
        const url = video.url;
        const title = video.title.replace(/[\\/:*?"<>|]/g, ''); // sanitize

        // Temp folder
        const tempFolder = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });
        const filePath = path.join(tempFolder, `${title}.mp3`);

        // ⏳ Download audio
        const audioStream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
        await pump(audioStream, fs.createWriteStream(filePath));

        // 📤 Send audio
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(filePath),
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });

        // Cleanup
        fs.unlinkSync(filePath);

    } catch (error) {
        console.error('[PLAY COMMAND ERROR]', error);
        await sock.sendMessage(chatId, {
            text: "❌ Download failed. No external API needed!"
        }, { quoted: message });
    }
}

module.exports = playCommand;
