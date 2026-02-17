const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');

const RAPIDAPI_KEY = '5d4e56db58msh55bbcd4deee6ecep16c392jsn10acea30237c';
const RAPIDAPI_HOST = 'spotify-music-mp3-downloader-api.p.rapidapi.com';

async function spotifyCommand(sock, chatId, message, options = { ptt: false }) {
    try {
        // 📝 Extract user input
        const rawText = message.message?.conversation?.trim() ||
                        message.message?.extendedTextMessage?.text?.trim() ||
                        message.message?.imageMessage?.caption?.trim() ||
                        message.message?.videoMessage?.caption?.trim() ||
                        '';

        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { 
                text: 'Usage: .spotify <song/artist/keywords>\nExample: .spotify con calma' 
            }, { quoted: message });
            return;
        }

        // 🔎 Search on RapidAPI Spotify Downloader
        const response = await axios.get(`https://${RAPIDAPI_HOST}/search`, {
            params: { query },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST
            },
            responseType: 'json'
        });

        if (!response.data || !response.data.result || !response.data.result.length) {
            await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
            return;
        }

        const track = response.data.result[0]; // first result
        const { title, thumbnail, url: downloadUrl, duration } = track;

        // 🖼 Send thumbnail + track info
        await sock.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 ${title}\n⏱ ${duration}\n🔗 ${downloadUrl}`
        }, { quoted: message });

        // ⬇️ Download audio
        const audioResp = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        let audioBuffer = Buffer.from(audioResp.data);

        // 🎶 Convert to MP3 if needed
        audioBuffer = await toAudio(audioBuffer, 'mp3'); // RapidAPI may already be mp3
        if (!audioBuffer || audioBuffer.length === 0) throw new Error('Conversion failed');

        // 📤 Send audio
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: options.ptt || false
        }, { quoted: message });

        // 🧹 Cleanup temp files (optional)
        try {
            const tempDir = path.join(__dirname, '../temp');
            if (fs.existsSync(tempDir)) {
                fs.readdirSync(tempDir).forEach(file => {
                    const filePath = path.join(tempDir, file);
                    try { fs.unlinkSync(filePath); } catch {}
                });
            }
        } catch {}

    } catch (err) {
        console.error('[SPOTIFY] error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch track. Try again later.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;
