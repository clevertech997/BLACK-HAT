const { downloadAudio } = require('../lib/yt-dlp-helper');
const fs = require('fs');
const yts = require('yt-search');
const axios = require('axios'); // For fallback API

async function fallbackDownload(query) {
    try {
        // Example fallback: fetch audio link from some API (pseudo-code)
        const search = await yts(query);
        if (!search || !search.videos.length) return null;

        const video = search.videos[0];
        // Use video.url to fetch audio via fallback service
        // Here we simulate: just return video url to downloadAudio again
        return { url: video.url, title: video.title, thumbnail: video.thumbnail, timestamp: video.timestamp };
    } catch (err) {
        console.error('Fallback failed', err);
        return null;
    }
}

async function songCommand(sock, chatId, message) {
    try {
        const body =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!body.toLowerCase().startsWith('.song')) return;

        const query = body.replace('.song', '').trim();
        if (!query) {
            return await sock.sendMessage(
                chatId,
                { text: '⚠️ Please provide a song name.\nExample: *.song shape of you*' },
                { quoted: message }
            );
        }

        let audioData;
        let videoUrl, title, thumbnail, timestamp;

        // First attempt: yt-dlp
        try {
            const search = await yts(query);
            if (!search || !search.videos.length) throw new Error('No results');

            const video = search.videos[0];
            videoUrl = video.url;
            title = video.title.replace(/[<>:"/\\|?*]+/g, '');
            thumbnail = video.thumbnail;
            timestamp = video.timestamp;

            audioData = await downloadAudio(videoUrl);

        } catch (err) {
            console.error('yt-dlp failed:', err);

            // Fallback
            const fallback = await fallbackDownload(query);
            if (!fallback) {
                return await sock.sendMessage(
                    chatId,
                    { text: '❌ Failed to download the song.' },
                    { quoted: message }
                );
            }

            videoUrl = fallback.url;
            title = fallback.title.replace(/[<>:"/\\|?*]+/g, '');
            thumbnail = fallback.thumbnail;
            timestamp = fallback.timestamp;

            audioData = await downloadAudio(videoUrl);
        }

        // Send thumbnail + info
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 *Downloading...*\n\n📌 Title: ${title}\n⏱ Duration: ${timestamp}`
        }, { quoted: message });

        // Send audio
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(audioData.path),
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`
        }, { quoted: message });

        // Cleanup
        fs.unlinkSync(audioData.path);

    } catch (err) {
        console.error('Final error:', err);
        await sock.sendMessage(
            chatId,
            { text: '❌ Failed to download the song.' },
            { quoted: message }
        );
    }
}

module.exports = songCommand;
