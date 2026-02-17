const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: "Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/..."
            }, { quoted: message });
        }

        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: "Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/..."
            }, { quoted: message });
        }

        if (!url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, {
                text: "That is not a Facebook link."
            }, { quoted: message });
        }

        // 🔄 Loading reaction
        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        // ==============================
        // RESOLVE REDIRECT URL
        // ==============================
        let resolvedUrl = url;
        try {
            const res = await axios.get(url, {
                timeout: 15000,
                maxRedirects: 10,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const finalUrl = res?.request?.res?.responseUrl;
            if (finalUrl) resolvedUrl = finalUrl;
        } catch {
            resolvedUrl = url;
        }

        // ==============================
        // RAPIDAPI REQUEST
        // ==============================
        let fbvid = null;
        let title = "Facebook Video";

        try {
            const response = await axios({
                method: 'GET',
                url: 'https://facebook-video-downloader-api.p.rapidapi.com/facebook',
                params: { url: resolvedUrl },
                headers: {
                    'x-rapidapi-key': '5d4e56db58msh55bbcd4deee6ecep16c392jsn10acea30237c',
                    'x-rapidapi-host': 'facebook-video-downloader-api.p.rapidapi.com'
                },
                timeout: 20000
            });

            const data = response.data;

            if (data?.download_url) {
                fbvid = data.download_url;
                title = data.title || title;
            } 
            else if (data?.result?.url) {
                fbvid = data.result.url;
                title = data.result.title || title;
            } 
            else if (typeof data?.result === "string") {
                fbvid = data.result;
            }

        } catch (apiError) {
            console.error("RapidAPI failed:", apiError.message);
            throw new Error("RapidAPI request failed");
        }

        if (!fbvid) {
            return await sock.sendMessage(chatId, {
                text: `❌ Failed to fetch video.
Possible reasons:
• Video is private
• Link invalid
• API limit reached`
            }, { quoted: message });
        }

        // ==============================
        // TRY DIRECT URL METHOD
        // ==============================
        try {
            await sock.sendMessage(chatId, {
                video: { url: fbvid },
                mimetype: "video/mp4",
                caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻\n\n📝 Title: ${title}`
            }, { quoted: message });

            return;

        } catch (urlError) {
            console.error("Direct URL method failed:", urlError.message);

            // ==============================
            // FALLBACK BUFFER METHOD
            // ==============================
            try {
                const tmpDir = path.join(process.cwd(), 'tmp');
                if (!fs.existsSync(tmpDir)) {
                    fs.mkdirSync(tmpDir, { recursive: true });
                }

                const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

                const videoResponse = await axios({
                    method: 'GET',
                    url: fbvid,
                    responseType: 'stream',
                    timeout: 60000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'Referer': 'https://www.facebook.com/'
                    }
                });

                const writer = fs.createWriteStream(tempFile);
                videoResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
                    throw new Error("Downloaded file empty");
                }

                await sock.sendMessage(chatId, {
                    video: { url: tempFile },
                    mimetype: "video/mp4",
                    caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻\n\n📝 Title: ${title}`
                }, { quoted: message });

                // Cleanup
                fs.unlinkSync(tempFile);

                return;

            } catch (bufferError) {
                console.error("Buffer method failed:", bufferError.message);
                throw new Error("Both sending methods failed");
            }
        }

    } catch (error) {
        console.error("Facebook command error:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Error: " + error.message
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
