const os = require('os');
const settings = require('../settings.js');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

async function pingCommand(sock, chatId, message) {
    try {
        // Step 1: Measure ping
        const start = Date.now();
        await sock.sendMessage(chatId, { text: '🏓 Pong!' }, { quoted: message });
        const end = Date.now();
        const ping = Math.round((end - start) / 2);

        // Step 2: Get uptime
        const uptimeInSeconds = process.uptime();
        const uptimeFormatted = formatTime(uptimeInSeconds);

        // Step 3: Build hacker-style bot info
        const botInfo = `
╭━❮🤖 𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 ❯━┈⊷
│ ⚡ Ping     : ${ping} ms
│ ⏱️ Uptime   : ${uptimeFormatted}
│ 🏷️ Version  : v${settings.version}
│ 💻 Platform : Node.js
│ 🌐 Status   : Online 🟢
╰━━━━━━━━━━━━━━━━━━━━⪼
`.trim();

        // Step 4: Send bot info with forwarding metadata
        await sock.sendMessage(chatId, {
            text: botInfo,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363422524788798@newsletter',
                    newsletterName: '𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in ping command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get bot status.' }, { quoted: message });
    }
}

module.exports = pingCommand;
