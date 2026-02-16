const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please specify the song you want to download.\nUsage: *play <song name>*"
            }, { quoted: message });
        }

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: `❌ No songs found for "${searchQuery}".`
            }, { quoted: message });
        }

        const video = videos[0];
        const title = video.title.replace(/[<>:"/\\|?*]+/g, '');
        const urlYt = video.url;
        const thumbnail = video.thumbnail;
        const duration = video.timestamp;
        const uploader = video.author.name;

        // Send video info with button
        const messageButtons = [
            { buttonId: `play ${title}`, buttonText: { displayText: '🎵 Download Audio' }, type: 1 },
            { buttonId: 'join_channel', buttonText: { displayText: '📢 Join Channel' }, type: 1 }
        ];

        const buttonMessage = {
            image: { url: thumbnail },
            caption: `🎶 *${title}*\n⏱ Duration: ${duration}\n👤 Uploader: ${uploader}\n\nPress the button below to download audio.`,
            footer: '𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻',
            buttons: messageButtons,
            headerType: 4
        };

        await sock.sendMessage(chatId, buttonMessage, { quoted: message });

        // Prepare folder for downloads
        const downloadsFolder = path.join(__dirname, '../downloads');
        if (!fs.existsSync(downloadsFolder)) fs.mkdirSync(downloadsFolder);

        const filePath = path.join(downloadsFolder, `${title}.mp3`);
        const stream = ytdl(urlYt, { filter: 'audioonly', quality: 'highestaudio' });
        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        writeStream.on('finish', async () => {
            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(filePath),
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`
            }, { quoted: message });

            fs.unlinkSync(filePath);
        });

        writeStream.on('error', async (err) => {
            console.error('Error writing audio file:', err);
            await sock.sendMessage(chatId, { 
                text: "❌ Failed to download the song. Please try again later."
            }, { quoted: message });
        });

    } catch (error) {
        console.error('Error in playCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An error occurred while processing your request."
        }, { quoted: message });
    }
}

module.exports = playCommand;
