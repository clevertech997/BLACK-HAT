const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

async function emojimixCommand(sock, chatId, msg) {
    try {
        // Get text after command
        const text = msg.message?.conversation?.trim() || 
                     msg.message?.extendedTextMessage?.text?.trim() || '';
        const args = text.split(' ').slice(1);

        if (!args[0]) {
            return await sock.sendMessage(chatId, { text: '🎴 Example: .emojimix 😎+🥰' });
        }

        if (!args[0].includes('+')) {
            return await sock.sendMessage(chatId, { 
                text: '✳️ Use a *+* to separate emojis\n📌 Example: .emojimix 😎+🥰' 
            });
        }

        let [emoji1, emoji2] = args[0].split('+').map(e => e.trim());
        if (!emoji1 || !emoji2) {
            return await sock.sendMessage(chatId, { text: '❌ Invalid emoji input. Example: .emojimix 😎+🥰' });
        }

        // Tenor API endpoint
        const url = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: '❌ These emojis cannot be mixed! Try different ones.' 
            });
        }

        const imageUrl = data.results[0].url;

        // Temporary files
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const timestamp = Date.now();
        const tempFile = path.join(tmpDir, `temp_${timestamp}.png`);
        const outputFile = path.join(tmpDir, `sticker_${timestamp}.webp`);

        // Download image
        const imageResponse = await fetch(imageUrl);
        const buffer = await imageResponse.buffer();
        fs.writeFileSync(tempFile, buffer);

        // Convert to WebP with ffmpeg
        const ffmpegCommand = `ffmpeg -y -i "${tempFile}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" "${outputFile}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (err) => {
                if (err) {
                    console.error('FFmpeg error:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        if (!fs.existsSync(outputFile)) throw new Error('Failed to create sticker');

        const stickerBuffer = fs.readFileSync(outputFile);

        // Send sticker
        await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });

        // Cleanup
        [tempFile, outputFile].forEach(file => {
            try { fs.unlinkSync(file); } catch (e) { console.warn('Temp cleanup error:', e.message); }
        });

    } catch (error) {
        console.error('❌ Emojimix command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to mix emojis! Use valid emojis.\nExample: .emojimix 😎+🥰' 
        });
    }
}

module.exports = emojimixCommand;
