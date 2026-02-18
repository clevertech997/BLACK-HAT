const settings = require("../settings");
const os = require("os");
const { networkInterfaces } = require("os");

function getCPUUsage() {
    return new Promise((resolve) => {
        const startMeasure = os.cpus();

        setTimeout(() => {
            const endMeasure = os.cpus();
            let idleDiff = 0;
            let totalDiff = 0;

            for (let i = 0; i < startMeasure.length; i++) {
                const start = startMeasure[i].times;
                const end = endMeasure[i].times;

                const idle = end.idle - start.idle;
                const total = Object.keys(end).reduce((acc, key) => acc + (end[key] - start[key]), 0);

                idleDiff += idle;
                totalDiff += total;
            }

            const usage = 100 - Math.floor((idleDiff / totalDiff) * 100);
            resolve(usage);
        }, 500); // measure over 0.5 sec
    });
}

function getNetworkStats() {
    const nets = networkInterfaces();
    const stats = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (!net.internal && net.family === 'IPv4') {
                stats.push({ iface: name, ip: net.address });
            }
        }
    }
    return stats.map(n => `${n.iface}: ${n.ip}`).join(' | ') || 'N/A';
}

async function aliveCommand(sock, chatId, message) {
    try {
        // Uptime
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

        // Ping
        const start = Date.now();
        await sock.sendPresenceUpdate('composing', chatId);
        const ping = Date.now() - start;

        // Memory
        const totalMemMB = Math.floor(os.totalmem() / 1024 / 1024);
        const freeMemMB = Math.floor(os.freemem() / 1024 / 1024);
        const usedMemMB = totalMemMB - freeMemMB;
        const memPercent = Math.floor((usedMemMB / totalMemMB) * 100);

        // CPU
        const cpuUsage = await getCPUUsage();
        const cpuModel = os.cpus()[0]?.model || 'Unknown';
        const cpuCores = os.cpus().length;

        // Network
        const netStats = getNetworkStats();

        const messageText = `
╭━❮_𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻_❯━┈⊷
│ ⚡ Ping          : ${ping} ms
│ ⏱️ Uptime        : ${uptimeFormatted}
│ 🏷️ Version       : v${settings.version || '1.0.0'}
│ 💻 Platform      : Node.js ${process.version}
│ 🌐 Status        : Online 🟢
╰━━━━━━━━━━━━━━⪼

╭━━━━━━━━━━━━━━━┈⊷
║⚡_BLACK HAT SYSTEM_⚡
║🔐 _Advanced Cyber Bot_ 🔐
║💾 Memory Usage  : ${usedMemMB}/${totalMemMB} MB (${memPercent}%)
║🖥 CPU           : ${cpuModel} (${cpuCores} cores) | ${cpuUsage}%
║🌐 Network       : ${netStats}
╰━━━━━━━━━━━━━━⪼

╭━━━━━━━━━━━━━━━┈⊷
║🟢 *Status:* ONLINE ✅
║🛡 *Security Level:* MAXIMUM 🔥
║⚙ *Engine:* Active & Stable 💎
╰━━━━━━━━━━━━━━⪼

╭━❮🌟🔥 *CORE FEATURES* 🔥🌟❯━┈⊷
║▸ 👥 Group Management Tools
║▸ 🔗 Anti-Link Protection
║▸ 🧹 Anti-Spam Shield
║▸ 🎮 Fun & Games Commands
║▸ 📥 Media Downloader
║▸ 🤖 Auto Replies System
║▸ 🚀 Fast Performance Mode
║▸ 💡 Smart Utilities
║▸ 🎵 Music Tools
║▸ 🛠 Admin Controls
╰━━━━━━━━━━━━━━⪼

╭━━━━━━━━━━━━━━━┈⊷
║📌 Type *.menu* for full command list 📜
║⚡ Powered by BLACK HAT ⚡
║🔐 Stay Secure. Stay Anonymous.
╰━━━━━━━━━━━━━━⪼
`;

        await sock.sendMessage(chatId, {
            text: messageText,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363422524788798@newsletter',
                    newsletterName: '𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻',
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
