const yts = require('yt-search');
const ytdl = require('ytdl-core');

const cooldown = new Map(); // Anti-spam system
const COOLDOWN_TIME = 15000; // 15 seconds

async function videoCommand(sock, chatId, message, senderId) {
    try {
        const rawText =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            '';

        const args = rawText.trim().split(/\s+/);
        args.shift(); // remove command (.video)

        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Usage:\n.video <name>\n.video 360p <name>\n.video 720p <name>"
            }, { quoted: message });
        }

        // 🚫 Cooldown Protection
        if (cooldown.has(senderId)) {
            const expire = cooldown.get(senderId);
            if (Date.now() < expire) {
                const left = Math.ceil((expire - Date.now()) / 1000);
                return await sock.sendMessage(chatId, {
                    text: `⏳ Please wait ${left}s before using this command again.`
                }, { quoted: message });
            }
        }

        cooldown.set(senderId, Date.now() + COOLDOWN_TIME);

        // 🎯 Quality detect
        let quality = "18"; // default 360p
        let qualityLabel = "360p";

        if (args[0] === "720p") {
            quality = "22";
            qualityLabel = "720p";
            args.shift();
        } else if (args[0] === "360p") {
            quality = "18";
            qualityLabel = "360p";
            args.shift();
        }

        const query = args.join(" ").trim();
        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Please provide video name."
            }, { quoted: message });
        }

        // 🔎 Search
        const search = await yts(query);
        if (!search.videos.length) {
            return await sock.sendMessage(chatId, {
                text: "❌ No results found."
            }, { quoted: message });
        }

        const video = search.videos[0];

        if (video.seconds > 900) {
            return await sock.sendMessage(chatId, {
                text: "❌ Video too long. Max allowed is 15 minutes."
            }, { quoted: message });
        }

        const title = video.title.replace(/[<>:"/\\|?*]+/g, '');
        const url = video.url;

        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption:
`🎬 *VIDEO DOWNLOADER ULTRA*

📌 Title: ${title}
⏱ Duration: ${video.timestamp}
🎥 Quality: ${qualityLabel}
👤 Author: ${video.author.name}

⬇️ Processing...`
        }, { quoted: message });

        const info = await ytdl.getInfo(url);

        let format = ytdl.chooseFormat(info.formats, {
            quality: quality
        });

        // 🔁 Auto fallback
        if (!format) {
            format = ytdl.chooseFormat(info.formats, {
                quality: '18'
            });
        }

        if (!format) {
            return await sock.sendMessage(chatId, {
                text: "❌ Failed to get video format."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            video: { url: format.url },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption: `✅ Download complete\n🎥 ${qualityLabel}`
        }, { quoted: message });

    } catch (err) {
        console.error("[ULTRA VIDEO ERROR]", err);

        await sock.sendMessage(chatId, {
            text: "❌ Download failed. Try another video."
        }, { quoted: message });
    }
}

module.exports = videoCommand;
