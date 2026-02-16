const { ttdl } = require("ruhend-scraper");
const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link." });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link." });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//
        ];
        if (!tiktokPatterns.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, { text: "Invalid TikTok link." });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        // Download TikTok data using ttdl
        let downloadData;
        try {
            downloadData = await ttdl(url);
        } catch (err) {
            console.error("ttdl failed:", err.message);
            return await sock.sendMessage(chatId, { text: "Failed to fetch TikTok video." }, { quoted: message });
        }

        if (!downloadData?.data?.length) {
            return await sock.sendMessage(chatId, { text: "No media found in TikTok video." }, { quoted: message });
        }

        // Take the first media (usually the video)
        const media = downloadData.data[0];
        const mediaUrl = media.url;
        const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || media.type === 'video';

        // Fetch media as buffer
        try {
            const response = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024, // 100MB
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'video/mp4,video/*,*/*;q=0.9',
                    'Referer': 'https://www.tiktok.com/'
                }
            });

            const buffer = Buffer.from(response.data);

            if (!buffer || buffer.length < 1000) {
                throw new Error("Video buffer too small or empty");
            }

            const caption = downloadData.metadata?.title 
                ? `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻\n📝 Title: ${downloadData.metadata.title}`
                : "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻";

            if (isVideo) {
                await sock.sendMessage(chatId, {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    image: buffer,
                    caption: caption
                }, { quoted: message });
            }
        } catch (bufferError) {
            console.error("Failed to fetch media buffer:", bufferError.message);
            return await sock.sendMessage(chatId, { text: "Failed to download TikTok video content." }, { quoted: message });
        }

    } catch (error) {
        console.error("Error in TikTok command:", error);
        await sock.sendMessage(chatId, { text: "An unexpected error occurred." }, { quoted: message });
    }
}

module.exports = tiktokCommand;
