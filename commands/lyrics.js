const axios = require('axios');
const cheerio = require('cheerio');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, { 
            text: '🔍 Please enter the song name to get the lyrics! Usage: *lyrics <song name>*'
        }, { quoted: message });
        return;
    }

    try {
        // Genius search URL
        const searchUrl = `https://genius.com/api/search/multi?per_page=5&q=${encodeURIComponent(songTitle)}`;
        const searchRes = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        // Get first song hit
        const songHit = searchRes.data.response.sections.find(s => s.type === 'song')?.hits[0];
        if (!songHit) {
            await sock.sendMessage(chatId, { text: `❌ No lyrics found for "${songTitle}".` }, { quoted: message });
            return;
        }

        const songUrl = songHit.result.url;

        // Fetch lyrics page
        const pageRes = await axios.get(songUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(pageRes.data);

        // Genius lyrics are inside <div data-lyrics-container="true">
        let lyrics = '';
        $('div[data-lyrics-container="true"]').each((i, elem) => {
            lyrics += $(elem).text().trim() + '\n';
        });

        if (!lyrics) {
            await sock.sendMessage(chatId, { text: `❌ Could not extract lyrics for "${songTitle}".` }, { quoted: message });
            return;
        }

        // Limit message size to 4096 characters (WhatsApp limit)
        const maxChars = 4096;
        const output = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + '...' : lyrics;

        await sock.sendMessage(chatId, { text: output }, { quoted: message });

    } catch (error) {
        console.error('Error fetching lyrics:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ An error occurred while fetching lyrics for "${songTitle}".`
        }, { quoted: message });
    }
}

module.exports = { lyricsCommand };
