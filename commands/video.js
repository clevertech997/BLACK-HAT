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
            return await sock.sendMessage(chatId, {
                text: 'Usage: .video <YouTube link or search query>'
            }, { quoted: message });
        }

        let videoUrl;
        let videoTitle = '';
        let videoThumbnail = '';

        // 🔎 Search if not URL
        if (!args.startsWith('http')) {
            const search = await yts(args);
            if (!search.videos.length) {
                return await sock.sendMessage(chatId, {
                    text: '❌ No videos found.'
                }, { quoted: message });
            }

            const video = search.videos[0];
            videoUrl = video.url;
            videoTitle = video.title;
            videoThumbnail = video.thumbnail;
        } else {
            videoUrl = args;
        }

        // Validate URL
        if (!ytdl.validateURL(videoUrl)) {
            return await sock.sendMessage(chatId, {
                text: '❌ Invalid YouTube link.'
            }, { quoted: message });
        }

        const info = await ytdl.getInfo(videoUrl);

        videoTitle = videoTitle || info.videoDetails.title;
        videoThumbnail =
            videoThumbnail ||
            info.videoDetails.thumbnails.slice(-1)[0]?.url;

        // Send thumbnail preview
        if (videoThumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: videoThumbnail },
                caption: `🎬 *${videoTitle}*\n⬇ Downloading video...`
            }, { quoted: message });
        }

        // Choose best progressive MP4 (video+audio together)
        const format = ytdl.chooseFormat(info.formats, {
            quality: 'highest',
            filter: 'audioandvideo'
        });

        if (!format) {
            throw new Error('No suitable format found.');
        }

        // Stream video directly
        const stream = ytdl(videoUrl, { format });

        await sock.sendMessage(chatId, {
            video: stream,
            mimetype: 'video/mp4',
            fileName: `${videoTitle}.mp4`,
            caption: `🎬 *${videoTitle}*\n\n> Downloaded by 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻`
        }, { quoted: message });

    } catch (error) {
        console.error('[VIDEO ERROR]', error);
        await sock.sendMessage(chatId, {
            text: '❌ Download failed.\n' + error.message
        }, { quoted: message });
    }
}

module.exports = videoCommand;
