const yts = require('yt-search');
const axios = require('axios');

const RAPID_KEY = "5d4e56db58msh55bbcd4deee6ecep16c392jsn10acea30237c";

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(" ").slice(1).join(" ").trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "Please enter a song name."
            });
        }

        // Search YouTube
        const { videos } = await yts(searchQuery);
        if (!videos.length) {
            return await sock.sendMessage(chatId, { 
                text: "No song found."
            });
        }

        const video = videos[0];
        const urlYt = video.url;

        await sock.sendMessage(chatId, {
            text: "Please wait, downloading..."
        });

        // Call RapidAPI
        const response = await axios.get(
            "https://youtube-to-mp315.p.rapidapi.com/title",
            {
                params: { url: urlYt },
                headers: {
                    "x-rapidapi-key": RAPID_KEY,
                    "x-rapidapi-host": "youtube-to-mp315.p.rapidapi.com"
                }
            }
        );

        const data = response.data;

        if (!data || !data.link) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to get audio."
            });
        }

        const audioUrl = data.link;

        // Send audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${video.title}.mp3`
        }, { quoted: message });

    } catch (err) {
        console.log(err);
        await sock.sendMessage(chatId, { 
            text: "Download failed. Please try again."
        });
    }
}

module.exports = playCommand;
