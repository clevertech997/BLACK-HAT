const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';

        const query = text.split(" ").slice(1).join(" ").trim();

        if (!query) return await sock.sendMessage(chatId, {
            text: "⚠️ Usage: .play <song name or youtube link>"
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: "🔎", key: message.key } });

        let videoUrl, title, thumbnail;

        // Direct YouTube link
        if (ytdl.validateURL(query)) {
            videoUrl = query;
            const info = await ytdl.getInfo(videoUrl);
            title = info.videoDetails.title;
            thumbnail = info.videoDetails.thumbnails?.pop()?.url || null;
        } else {
            const search = await yts(query);
            if (!search.videos.length) return await sock.sendMessage(chatId, {
                text: "❌ No song found."
            }, { quoted: message });

            const video = search.videos[0];
            videoUrl = video.url;
            title = video.title;
            thumbnail = video.thumbnail;
        }

        title = title.replace(/[<>:"/\\|?*]+/g, '');

        // Send thumbnail + pro caption
        if (thumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: thumbnail },
                caption: `╭━❮ *𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 MUSIC* ❯━┈⊷
🎵 Title: ${title}
⬇️ Downloading High Quality Audio...
╰━━━━━━━━━━━━⪼`
            }, { quoted: message });
        }

        // Ensure temp folder exists
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const filePath = path.join(tempDir, `${Date.now()}.mp3`);

        // Stream audio
        const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size > 40 * 1024 * 1024) { // >40MB
            fs.unlinkSync(filePath);
            return await sock.sendMessage(chatId, { 
                text: "❌ Audio too large to send (>40MB)."
            }, { quoted: message });
        }

        // Send audio
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });

        // Auto send voice note version
        const voicePath = filePath.replace('.mp3', '.opus');
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i "${filePath}" -c:a libopus -b:a 64k "${voicePath}"`, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        await sock.sendMessage(chatId, {
            audio: { url: voicePath },
            mimetype: "audio/ogg; codecs=opus",
            ptt: true
        }, { quoted: message });

        // Clean up temp files
        fs.unlinkSync(filePath);
        fs.unlinkSync(voicePath);

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.error("[PLAY ULTRA ERROR]", err);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to fetch song.\nTry another name or YouTube link."
        }, { quoted: message });
    }
}

module.exports = playCommand;
