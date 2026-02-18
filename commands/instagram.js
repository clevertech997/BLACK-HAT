const axios = require("axios");

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

// Remove exact duplicate URLs
function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();

    for (const media of mediaData) {
        if (!media.url) continue;

        if (!seenUrls.has(media.url)) {
            seenUrls.add(media.url);
            uniqueMedia.push(media);
        }
    }

    return uniqueMedia;
}

async function instagramCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;

        processedMessages.add(message.key.id);

        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: "Please provide an Instagram link."
            });
        }

        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//
        ];

        const isValidUrl = instagramPatterns.some(pattern => pattern.test(text));

        if (!isValidUrl) {
            return await sock.sendMessage(chatId, {
                text: "That is not a valid Instagram link."
            });
        }

        // 🔄 Loading reaction
        await sock.sendMessage(chatId, {
            react: { text: "🔄", key: message.key }
        });

        // ==============================
        // RAPIDAPI REQUEST
        // ==============================

        const response = await axios({
            method: "GET",
            url: "https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index",
            params: { url: text },
            headers: {
                "x-rapidapi-key": "5d4e56db58msh55bbcd4deee6ecep16c392jsn10acea30237c",
                "x-rapidapi-host":
                    "instagram-downloader-download-instagram-videos-stories.p.rapidapi.com"
            },
            timeout: 20000
        });

        const data = response.data;

        if (!data) {
            return await sock.sendMessage(chatId, {
                text: "❌ No media found. Post may be private or invalid."
            });
        }

        let mediaArray = [];

        // Adjust depending on API structure
        if (Array.isArray(data.media)) {
            mediaArray = data.media;
        } else if (Array.isArray(data.result)) {
            mediaArray = data.result;
        } else if (data.url) {
            mediaArray = [{ url: data.url, type: "video" }];
        }

        if (!mediaArray.length) {
            return await sock.sendMessage(chatId, {
                text: "❌ No downloadable media found."
            });
        }

        const uniqueMedia = extractUniqueMedia(mediaArray).slice(0, 20);

        for (let i = 0; i < uniqueMedia.length; i++) {
            try {
                const media = uniqueMedia[i];
                const mediaUrl = media.url;

                if (!mediaUrl) continue;

                const isVideo =
                    media.type === "video" ||
                    mediaUrl.match(/\.(mp4|mov|webm)$/i) ||
                    text.includes("/reel/") ||
                    text.includes("/tv/");

                if (isVideo) {
                    await sock.sendMessage(chatId, {
                        video: { url: mediaUrl },
                        mimetype: "video/mp4",
                        caption: "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻-𝗕𝗢𝗧"
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: mediaUrl },
                        caption: "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻-𝗕𝗢𝗧"
                    }, { quoted: message });
                }

                // Delay to avoid rate limit
                if (i < uniqueMedia.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (mediaError) {
                console.error(`Error sending media ${i + 1}:`, mediaError.message);
            }
        }

    } catch (error) {
        console.error("Instagram Command Error:", error.message);

        await sock.sendMessage(chatId, {
            text: "❌ RapidAPI Error: " + error.message
        });
    }
}

module.exports = instagramCommand;
