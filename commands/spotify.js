const yts = require('yt-search');
const ytdl = require('ytdl-core');
const { toAudio } = require('../lib/converter');
const path = require('path');
const fs = require('fs');

async function spotifyCommand(sock, chatId, message, options = { ptt: false }) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { 
                text: 'Usage: .spotify <song/artist/keywords>\nExample: .spotify con calma' 
            }, { quoted: message });
            return;
        }

        // 🔎 Search on YouTube
        const search = await yts(query);
        if (!search.videos.length) {
            await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
            return;
        }

        const video = search.videos[0];
        const videoUrl = video.url;
        const title = video.title.replace(/[<>:"/\\|?*]+/g, '');
        const thumbnail = video.thumbnail;
        const duration = video.timestamp;

        // 🖼 Send thumbnail + info
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 ${title}\n⏱ ${duration}\n🔗 ${videoUrl}`
        }, { quoted: message });

        // ⬇️ Stream audio only (memory efficient)
        const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        let audioBuffer = Buffer.concat(chunks);

        // 🎶 Convert to MP3 if not already
        audioBuffer = await toAudio(audioBuffer, 'webm'); // ytdl usually gives webm
        if (!audioBuffer || audioBuffer.length === 0) throw new Error('Conversion failed');

        // 📤 Send audio
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: options.ptt || false
        }, { quoted: message });

        // 🧹 Cleanup temp files
        try {
            const tempDir = path.join(__dirname, '../temp');
            if (fs.existsSync(tempDir)) {
                fs.readdirSync(tempDir).forEach(file => {
                    const filePath = path.join(tempDir, file);
                    try { fs.unlinkSync(filePath); } catch {}
                });
            }
        } catch {}

    } catch (err) {
        console.error('[SPOTIFY] error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch track. Try again later.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;
