const yts = require('yt-search');
const axios = require('axios');

async function songCommand(sock, chatId, message) {
    try {
        // 🔹 Extract message text
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: 'Usage: .song <song name or YouTube link>'
            }, { quoted: message });
        }

        let video;
        let urlYt;

        // 🔹 If message is a direct YouTube URL
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            urlYt = text.trim();
            video = { url: urlYt, title: 'Audio' }; // placeholder title
        } else {
            // 🔹 Search YouTube if not a link
            const search = await yts(text);
            if (!search.videos.length) {
                return await sock.sendMessage(chatId, {
                    text: '❌ No results found.'
                }, { quoted: message });
            }
            video = search.videos[0];
            urlYt = video.url;
        }

        // 🔹 Send preview message with thumbnail + duration
        if (video.thumbnail || video.duration.seconds) {
            const duration = video.duration?.seconds || 0;
            const min = Math.floor(duration / 60);
            const sec = duration % 60;

            await sock.sendMessage(chatId, {
                image: { url: video.thumbnail },
                caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${min}:${sec < 10 ? '0'+sec : sec}`
            }, { quoted: message });
        } else {
            // fallback simple loading message
            await sock.sendMessage(chatId, {
                text: '_⏳ Downloading audio, please wait..._'
            }, { quoted: message });
        }

        // 🔹 RapidAPI Request to download MP3
        const options = {
            method: 'GET',
            url: 'https://youtube-mp3-audio-video-downloader.p.rapidapi.com/dl',
            params: { url: urlYt },
            headers: {
                'x-rapidapi-key': '5d4e56db58msh55bbcd4deee6ecep16c392jsn10acea30237c',
                'x-rapidapi-host': 'youtube-mp3-audio-video-downloader.p.rapidapi.com'
            },
            timeout: 30000
        };

        const response = await axios.request(options);
        const data = response.data;

        if (!data || !data.link) {
            return await sock.sendMessage(chatId, {
                text: '❌ Failed to fetch audio from RapidAPI.'
            }, { quoted: message });
        }

        const audioUrl = data.link;
        const title = (data.title || video.title || 'audio').replace(/[<>:"/\\|?*]+/g, '');

        // 🔹 Send MP3 file
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: false
        }, { quoted: message });

    } catch (err) {
        console.error('Song command error:', err.response?.data || err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to download song.\n${err.message}`
        }, { quoted: message });
    }
}

module.exports = songCommand;

/*
Powered by 𝑩𝑳𝑨𝑪𝑲✦𝑯𝑨𝑻✦𝗕𝗢𝗧
Credits to 𝑨𝒏𝒐𝒏𝒚𝒎𝒐𝒖𝒔 𝑼𝒔𝒆
*/
