const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        // Check if message has already been processed
        if (processedMessages.has(message.key.id)) {
            return;
        }
        
        // Add message ID to processed set
        processedMessages.add(message.key.id);
        
        // Clean up old message IDs after 5 minutes
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            });
        }

        // Extract URL from command
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            });
        }

        // Check for various TikTok URL formats
        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a valid TikTok link. Please provide a valid TikTok video link."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        try {

            // Extract video ID
            let videoIdMatch = url.match(/video\/(\d+)/);

            if (!videoIdMatch) {
                return await sock.sendMessage(chatId, { 
                    text: "Failed to download the TikTok video. Please try again with a different link."
                },{ quoted: message });
            }

            const videoId = videoIdMatch[1];

            // RapidAPI call (API KEY HUMO HUMO)
            const response = await axios.get(
                'https://tiktok-api23.p.rapidapi.com/api/post/detail',
                {
                    params: { videoId: videoId },
                    headers: {
                        'x-rapidapi-key': '5d4e56db58msh55bbcd4deee6ecep16c392jsn10acea30237c',
                        'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
                    },
                    timeout: 20000
                }
            );

            if (
                !response.data ||
                !response.data.itemInfo ||
                !response.data.itemInfo.itemStruct
            ) {
                throw new Error("Invalid API response");
            }

            const item = response.data.itemInfo.itemStruct;

            const videoUrl = item.video?.playAddr;
            const audioUrl = item.music?.playUrl;
            const title = item.desc || null;

            if (!videoUrl) {
                throw new Error("No video URL found");
            }

            // Download video as buffer
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024
            });

            const videoBuffer = Buffer.from(videoResponse.data);

            if (videoBuffer.length === 0) {
                throw new Error("Video buffer is empty");
            }

            const caption = title 
                ? `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲✦𝑯𝑨𝑻✦𝗕𝗢𝗧\n\n📝 Title: ${title}` 
                : "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲✦𝑯𝑨𝑻✦𝗕𝗢𝗧";
                    
            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: message });

            // Send audio if available
            if (audioUrl) {
                try {
                    const audioResponse = await axios.get(audioUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000
                    });

                    const audioBuffer = Buffer.from(audioResponse.data);

                    await sock.sendMessage(chatId, {
                        audio: audioBuffer,
                        mimetype: "audio/mp3",
                        caption: "🎵 Audio from TikTok"
                    }, { quoted: message });

                } catch (audioError) {
                    console.error(`Failed to download audio: ${audioError.message}`);
                }
            }

            return;

        } catch (error) {
            console.error('Error in TikTok download:', error);
            await sock.sendMessage(chatId, { 
                text: "Failed to download the TikTok video. Please try again with a different link."
            },{ quoted: message });
        }

    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, { 
            text: "An error occurred while processing the request. Please try again later."
        },{ quoted: message });
    }
}

module.exports = tiktokCommand;
