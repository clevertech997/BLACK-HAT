const fs = require('fs');
const path = require('path');
const yts = require('yt-search');
const ytdl = require('ytdl-core');

async function videoCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
                        message.message?.extendedTextMessage?.text?.trim() ||
                        message.message?.imageMessage?.caption?.trim() ||
                        message.message?.videoMessage?.caption?.trim() ||
                        '';

        const used = rawText.split(/\s+/)[0] || '.video';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            return await sock.sendMessage(
                chatId,
                { text: '⚠️ Usage: .video <video name>\nExample: .video believer' },
                { quoted: message }
            );
        }

        // Search YouTube
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

        // Send preview
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎬 *Downloading Video...*\n\n📌 Title: ${title}\n⏱ Duration: ${timestamp}`
        }, { quoted: message });

        // Prepare temp path
        const filePath = path.join(__dirname, '../temp', `${Date.now()}.mp4`);

        // Download video
        const stream = ytdl(videoUrl, {
            quality: '18' // mp4 medium quality (stable kwa WhatsApp)
        });

        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        // Subiri download imalize
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Send video
        await sock.sendMessage(chatId, {
            video: fs.readFileSync(filePath),
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`
        }, { quoted: message });

        // Cleanup
        fs.unlinkSync(filePath);

    } catch (err) {
        console.error('[VIDEO CMD] Error:', err);
        await sock.sendMessage(
            chatId,
            { text: '❌ Failed to download video. Try another query later.' },
            { quoted: message }
        );
    }
}

module.exports = videoCommand;
