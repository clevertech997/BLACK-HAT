const yts = require('yt-search');
const ytdl = require('ytdl-core');

async function videoCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const args = text.split(' ').slice(1).join(' ').trim();

        if (!args) {
            return sock.sendMessage(chatId, {
                text: 'Usage: .video <YouTube link or search query>'
            }, { quoted: message });
        }

        let videoUrl;
        let videoTitle = '';
        let thumbnail = '';

        // 🔎 Search if not URL
        if (!args.startsWith('http')) {
            const search = await yts(args);
            if (!search.videos.length) {
                return sock.sendMessage(chatId, {
                    text: '❌ No videos found.'
                }, { quoted: message });
            }

            const video = search.videos[0];
            videoUrl = video.url;
            videoTitle = video.title;
            thumbnail = video.thumbnail;
        } else {
            videoUrl = args;
        }

        if (!ytdl.validateURL(videoUrl)) {
            return sock.sendMessage(chatId, {
                text: '❌ Invalid YouTube link.'
            }, { quoted: message });
        }

        const info = await ytdl.getInfo(videoUrl);

        videoTitle = videoTitle || info.videoDetails.title;
        thumbnail =
            thumbnail ||
            info.videoDetails.thumbnails.slice(-1)[0]?.url;

        // 📸 Send Thumbnail First
        const thumbMsg = await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎬 *${videoTitle}*\n\n⬇ Preparing download...`
        }, { quoted: message });

        // 🎥 Get progressive format (audio+video)
        const format = ytdl.chooseFormat(info.formats, {
            quality: '18', // 360p stable
            filter: 'audioandvideo'
        });

        if (!format) throw new Error('No suitable format found.');

        const totalSize = parseInt(format.contentLength || 0);

        // ⚠️ Size limit check (50MB safety)
        if (totalSize > 50 * 1024 * 1024) {
            return sock.sendMessage(chatId, {
                text: '❌ Video is too large for WhatsApp (max ~50MB).'
            }, { quoted: message });
        }

        const stream = ytdl(videoUrl, {
            quality: '18',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        });

        let downloaded = 0;
        let lastPercent = 0;
        const chunks = [];

        stream.on('data', async (chunk) => {
            downloaded += chunk.length;
            chunks.push(chunk);

            if (totalSize) {
                const percent = Math.floor((downloaded / totalSize) * 100);

                // Update every 10%
                if (percent >= lastPercent + 10) {
                    lastPercent = percent;
                    await sock.sendMessage(chatId, {
                        text: `⬇ Downloading... ${percent}%`
                    }, { quoted: thumbMsg });
                }
            }
        });

        stream.on('end', async () => {
            const buffer = Buffer.concat(chunks);

            await sock.sendMessage(chatId, {
                video: buffer,
                mimetype: 'video/mp4',
                fileName: `${videoTitle}.mp4`,
                caption: `✅ *${videoTitle}*\n\n> Downloaded successfully`
            }, { quoted: message });
        });

        stream.on('error', async (err) => {
            console.error(err);
            await sock.sendMessage(chatId, {
                text: '❌ Download failed: ' + err.message
            }, { quoted: message });
        });

    } catch (err) {
        console.error('[VIDEO ERROR]', err);
        await sock.sendMessage(chatId, {
            text: '❌ Error: ' + err.message
        }, { quoted: message });
    }
}

module.exports = videoCommand;
