const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: "❌ Example:\n.fb https://facebook.com/..."
            }, { quoted: message });
        }

        if (!url.includes("facebook.com") && !url.includes("fb.watch")) {
            return await sock.sendMessage(chatId, {
                text: "❌ Invalid Facebook link."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: "⏳", key: message.key }
        });

        const tmpDir = path.join(process.cwd(), "tmp");
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

        const videoPath = path.join(tmpDir, `fb_${Date.now()}.mp4`);
        const infoPath = path.join(tmpDir, `info_${Date.now()}.json`);

        // Step 1: Get video info (title + thumbnail)
        const infoCommand = `yt-dlp --dump-json "${url}" > "${infoPath}"`;

        exec(infoCommand, (infoError) => {
            if (infoError || !fs.existsSync(infoPath)) {
                console.error(infoError);
                return sock.sendMessage(chatId, {
                    text: "❌ Failed to fetch video info."
                }, { quoted: message });
            }

            let title = "Facebook Video";
            let thumbnail = null;

            try {
                const infoData = JSON.parse(fs.readFileSync(infoPath));
                title = infoData.title || title;
                thumbnail = infoData.thumbnail || null;
            } catch (err) {
                console.error("Info parse error:", err);
            }

            // Step 2: Download video
            const downloadCommand = `yt-dlp -f mp4 -o "${videoPath}" "${url}"`;

            exec(downloadCommand, async (downloadError) => {
                if (downloadError || !fs.existsSync(videoPath)) {
                    console.error(downloadError);
                    return await sock.sendMessage(chatId, {
                        text: "❌ Failed to download video."
                    }, { quoted: message });
                }

                try {
                    // Send thumbnail first (if available)
                    if (thumbnail) {
                        await sock.sendMessage(chatId, {
                            image: { url: thumbnail },
                            caption: `🎬 *${title}*\n\n⏳ Uploading video...`
                        }, { quoted: message });
                    }

                    // Send video
                    await sock.sendMessage(chatId, {
                        video: fs.readFileSync(videoPath),
                        mimetype: "video/mp4",
                        caption: `📥 Downloaded by BLACK HAT\n\n🎬 Title: ${title}`
                    }, { quoted: message });

                } catch (sendErr) {
                    console.error(sendErr);
                }

                // cleanup
                try {
                    fs.unlinkSync(videoPath);
                    fs.unlinkSync(infoPath);
                } catch {}
            });
        });

    } catch (err) {
        console.error("FB ERROR:", err);
        await sock.sendMessage(chatId, {
            text: "❌ Error downloading video."
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
