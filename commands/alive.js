const settings = require("../settings");
async function aliveCommand(sock, chatId, message) {
    try {
        const message1 = `
╔═════════════════════════════╗
║ 🤖⚡ BLACK HAT SYSTEM ⚡🤖║
║ 🔐 Advanced Cyber Bot 🔐   ║
╚═════════════════════════════╝

🟢 *Status:* ONLINE ✅
🌍 *Mode:* PUBLIC 🌐
🧬 *Version:* ${settings.version} 🚀
🛡 *Security Level:* MAXIMUM 🔥
⚙ *Engine:* Active & Stable 💎

━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟🔥 *CORE FEATURES* 🔥🌟
━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ 👥 Group Management Tools
▸ 🔗 Anti-Link Protection
▸ 🧹 Anti-Spam Shield
▸ 🎮 Fun & Games Commands
▸ 📥 Media Downloader
▸ 🤖 Auto Replies System
▸ 🚀 Fast Performance Mode
▸ 💡 Smart Utilities
▸ 🎵 Music Tools
▸ 🛠 Admin Controls

━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Type *.menu* to explore full command list 📜
⚡ Powered by BLACK HAT ⚡
🔐 Stay Secure. Stay Anonymous.
`;

        await sock.sendMessage(chatId, {
            text: message1,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363422524788798@newsletter',
                    newsletterName: '𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻Bot MD',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: 'Bot is alive and running!' }, { quoted: message });
    }
}

module.exports = aliveCommand;