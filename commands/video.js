const yts = require('yt-search');
const ytdl = require('ytdl-core');

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { text: '🎬 What video do you want?' }, { quoted: message });
        }

        let videoUrl = searchQuery.startsWith('http') ? searchQuery : null;
        let videoTitle = '';
        let videoThumbnail = '';

        if (!videoUrl) {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, { text: '❌ No videos found!' }, { quoted: message });
            }
            const video = videos[0];
            videoUrl = video.url;
            videoTitle = video.title;
            videoThumbnail = video.thumbnail;
        }

        const info = await ytdl.getInfo(videoUrl);
        const title = videoTitle || info.videoDetails.title;
        const thumbnail = videoThumbnail || info.videoDetails.thumbnails.pop().url;

        // Send thumbnail first
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `*${title}*\n⏳ Downloading video...`
        }, { quoted: message });

        // Get suitable format (fallback to next available)
        let format = ytdl.chooseFormat(info.formats, { quality: '18' });
        if (!format || !format.url) {
            format = info.formats.find(f => f.container === 'mp4' && f.hasVideo && f.hasAudio);
            if (!format) throw new Error('No suitable video format found');
        }

        // Send video directly
        await sock.sendMessage(chatId, {
            video: { url: format.url },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption: `*${title}*\n✔ Downloaded successfully`
        }, { quoted: message });

    } catch (error) {
        console.error('[VIDEO ERROR]', error);
        await sock.sendMessage(chatId, {
            text: '❌ Download failed. Video may be unavailable or format changed.'
        }, { quoted: message });
    }
}

module.exports = videoCommand;
