const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url || !url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { 
                text: "⚠️ Please provide a valid Facebook video URL.\nExample: .fb https://www.facebook.com/..." 
            }, { quoted: message });
        }

        // Loading reaction
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        // Fetch FB page HTML
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 20000
        });
        const html = res.data;

        // Parse video URLs
        const $ = cheerio.load(html);
        let hdUrl = null;
        let sdUrl = null;
        let title = $('title').text() || "Facebook Video";

        // Search for HD video URL
        const hdMatch = html.match(/"hd_src":"([^"]+)"/);
        if (hdMatch) hdUrl = hdMatch[1].replace(/\\u0025/g, '%').replace(/\\/g, '');

        // Search for SD video URL
        const sdMatch = html.match(/"sd_src":"([^"]+)"/);
        if (sdMatch) sdUrl = sdMatch[1].replace(/\\u0025/g, '%').replace(/\\/g, '');

        let fbvid = hdUrl || sdUrl;
        if (!fbvid) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Failed to extract video URL. The video might be private or unavailable." 
            }, { quoted: message });
        }

        // Temp directory
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        // Download video buffer
        const videoResponse = await axios({
            method: 'GET',
            url: fbvid,
            responseType: 'stream',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
                'Referer': 'https://www.facebook.com/'
            }
        });

        videoResponse.data.pipe(fs.createWriteStream(tempFile));
        await new Promise((resolve, reject) => {
            videoResponse.data.on('end', resolve);
            videoResponse.data.on('error', reject);
        });

        // Send video
        const caption = `╭━❮ *𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 DOWNLOAD* ❯━┈⊷
📝 Title: ${title}
⚡ Quality: ${hdUrl ? 'HD' : 'SD'}
╰━━━━━━━━━━━━⪼`;

        await sock.sendMessage(chatId, {
            video: { url: tempFile },
            mimetype: 'video/mp4',
            caption
        }, { quoted: message });

        // Cleanup
        fs.unlinkSync(tempFile);

    } catch (err) {
        console.error('Facebook pro command error:', err);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to download Facebook video.\nIt might be private or unavailable.\nError: " + err.message 
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
