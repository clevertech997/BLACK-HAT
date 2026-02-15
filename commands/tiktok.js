const { ttdl } = require("ruhend-scraper");
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { text: "❌ Please provide a TikTok link. Example: .tiktok <link>" }, { quoted: message });
        }

        // Basic TikTok URL validation
        if (!/https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//.test(url)) {
            return await sock.sendMessage(chatId, { text: "❌ Invalid TikTok URL." }, { quoted: message });
        }

        // Show downloading reaction
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let videoBuffer = null;
        let title = "TikTok Video";

        // Attempt to download via ttdl
        try {
            const downloadData = await ttdl(url);
            if (!downloadData || !downloadData.data || !downloadData.data.length) throw new Error('No video data found');

            const media = downloadData.data.find(m => m.type === 'video') || downloadData.data[0];
            if (!media || !media.url) throw new Error('No video URL found');

            // Download video as buffer
            const response = await axios.get(media.url, { responseType: 'arraybuffer', timeout: 60000 });
            videoBuffer = Buffer.from(response.data);
            title = downloadData.meta?.title || title;

        } catch (ttdlError) {
            console.error('❌ ttdl download failed:', ttdlError.message);

            // Fallback: attempt direct download
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
                videoBuffer = Buffer.from(response.data);
            } catch (fallbackError) {
                console.error('❌ Fallback download failed:', fallbackError.message);
            }
        }

        if (!videoBuffer || videoBuffer.length < 1000) {
            return await sock.sendMessage(chatId, { text: "❌ Failed to download TikTok video. Video may be private or removed." }, { quoted: message });
        }

        // Save temporary file
        const tmpDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tmpPath = path.join(tmpDir, `tt_${Date.now()}.mp4`);
        fs.writeFileSync(tmpPath, videoBuffer);

        // Send video
        await sock.sendMessage(chatId, {
            video: fs.readFileSync(tmpPath),
            mimetype: 'video/mp4',
            caption: `🎬 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲✦𝑯𝑨𝑻\n\n📝 Title: ${title}`
        }, { quoted: message });

        // Cleanup
        fs.unlinkSync(tmpPath);

    } catch (error) {
        console.error('❌ Error in TikTok command:', error);
        await sock.sendMessage(chatId, { text: "⚠️ An error occurred while processing TikTok video." }, { quoted: message });
    }
}

module.exports = tiktokCommand;
