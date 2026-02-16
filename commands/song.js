const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter'); // Ensure this converts webm/m4a → mp3
const os = require('os');

async function songCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: 'Usage: .song <song name or YouTube link>'
            }, { quoted: message });
        }

        let video;

        // If direct YouTube URL
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            video = { url: text };
        } else {
            const search = await yts(text);
            if (!search.videos.length) {
                return await sock.sendMessage(chatId, {
                    text: '❌ No results found.'
                }, { quoted: message });
            }
            video = search.videos[0];
        }

        // Fetch video info
        const info = await ytdl.getInfo(video.url);
        const title = info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, '');
        const thumbnail = info.videoDetails.thumbnails.pop()?.url;
        const duration = parseInt(info.videoDetails.lengthSeconds || 0);

        // Send preview message
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 Downloading: *${title}*\n⏱ Duration: ${Math.floor(duration / 60)}:${duration % 60}`
        }, { quoted: message });

        // Download audio stream
        const stream = ytdl(video.url, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });

        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        const audioBuffer = Buffer.concat(chunks);

        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('Empty audio buffer');
        }

        // Detect format (webm / m4a / ogg / wav)
        let inputExt = 'webm';
        const sig = audioBuffer.slice(0, 4).toString('ascii');
        if (sig === 'OggS') inputExt = 'ogg';
        if (sig === 'RIFF') inputExt = 'wav';
        if (audioBuffer.toString('ascii', 4, 8) === 'ftyp') inputExt = 'm4a';

        // Convert to MP3
        const mp3Buffer = await toAudio(audioBuffer, inputExt);
        if (!mp3Buffer || mp3Buffer.length === 0) {
            throw new Error('Conversion failed');
        }

        // Send final audio
        await sock.sendMessage(chatId, {
            audio: mp3Buffer,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: false
        }, { quoted: message });

        // Cleanup temp converter files
        const tempDir = path.join(__dirname, '../temp');
        if (fs.existsSync(tempDir)) {
            fs.readdirSync(tempDir).forEach(file => {
                const filePath = path.join(tempDir, file);
                try { fs.unlinkSync(filePath); } catch {}
            });
        }

    } catch (err) {
        console.error('Song command error:', err);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to download song.\n${err.message}`
        }, { quoted: message });
    }
}

module.exports = songCommand;
