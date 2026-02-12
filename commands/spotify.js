const { downloadAudio } = require('../lib/yt-dlp-helper');
const fs = require('fs');
const yts = require('yt-search');

async function spotifyCommand(sock, chatId, message) {
    try {
        // Pata text ya message
        const rawText = message.message?.conversation?.trim() ||
                        message.message?.extendedTextMessage?.text?.trim() ||
                        message.message?.imageMessage?.caption?.trim() ||
                        message.message?.videoMessage?.caption?.trim() ||
                        '';

        // Pata query baada ya .spotify
        const used = rawText.split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            return await sock.sendMessage(
                chatId,
                { text: '⚠️ Usage: .spotify <song/artist/keywords>\nExample: .spotify con calma' },
                { quoted: message }
            );
        }

        // YouTube search
        const search = await yts(query);
        if (!search || !search.videos.length) {
            return await sock.sendMessage(
                chatId,
                { text: '❌ No results found on YouTube.' },
                { quoted: message }
            );
        }

        const video = search.videos[0];
        const videoUrl = video.url;
        const title = video.title.replace(/[<>:"/\\|?*]+/g, '');
        const thumbnail = video.thumbnail;
        const timestamp = video.timestamp;

        // Tuma thumbnail + info
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 *Downloading...*\n\n📌 Title: ${title}\n⏱ Duration: ${timestamp}`
        }, { quoted: message });

        // Download audio
        const audio = await downloadAudio(videoUrl);

        // Tuma audio
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(audio.path),
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`
        }, { quoted: message });

        // Cleanup
        fs.unlinkSync(audio.path);

    } catch (err) {
        console.error('[SPOTIFY CMD] Error:', err);
        await sock.sendMessage(
            chatId,
            { text: '❌ Failed to fetch song. Try another query later.' },
            { quoted: message }
        );
    }
}

module.exports = spotifyCommand;
