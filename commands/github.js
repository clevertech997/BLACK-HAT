const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function githubCommand(sock, chatId, message) {
    try {
        // Fetch repo data
        const res = await fetch('https://api.github.com/repos/clevertech997/BLACK-HAT');
        if (!res.ok) throw new Error('Error fetching repository data');
        const json = await res.json();

        // Helper function: progress bar
        const createBar = (value, max = 100, length = 20) => {
            const filled = Math.round((value / max) * length);
            const empty = length - filled;
            const gradient = '█▓▒░'; // neon-like gradient
            return '█'.repeat(filled) + '░'.repeat(empty);
        };

        const maxStars = Math.max(json.stargazers_count, 100);
        const maxWatchers = Math.max(json.watchers_count, 100);
        const maxForks = Math.max(json.forks_count, 50);

        const starsBar = createBar(json.stargazers_count, maxStars);
        const watchersBar = createBar(json.watchers_count, maxWatchers);
        const forksBar = createBar(json.forks_count, maxForks);

        // Hacker / matrix HUD style text
        let txt = `
╔════════════════════════════════════════════╗
║ 乂  𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 𝗗𝗘𝗟𝗨𝗫𝗘 HUD 乂 ║
╠════════════════════════════════════════════╣
║ 🕶️ Name       : ${json.name}                       ║
║ 💾 Size       : ${(json.size / 1024).toFixed(2)} MB               ║
║ 🕰️ Updated    : ${moment(json.updated_at).format('DD/MM/YY - HH:mm:ss')} ║
║ 🔗 URL        : ${json.html_url}                  ║
╠════════════════════════════════════════════╣
║ 👁️ Watchers   : ${json.watchers_count} │${watchersBar}│ ║
║ ⭐ Stars      : ${json.stargazers_count} │${starsBar}│ ║
║ 🍴 Forks      : ${json.forks_count} │${forksBar}│ ║
╠════════════════════════════════════════════╣
║ 💥 乂  𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 DELUXE BOT 乂 💥 ║
╚════════════════════════════════════════════╝
`;

        // Read local bot image
        const imgPath = path.join(__dirname, '../assets/bot_image.jpg');
        if (!fs.existsSync(imgPath)) throw new Error('Bot image not found');
        const imgBuffer = fs.readFileSync(imgPath);

        // Send image with HUD caption
        await sock.sendMessage(chatId, { image: imgBuffer, caption: txt }, { quoted: message });

    } catch (error) {
        console.error('GitHub Deluxe HUD Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Error fetching repository information.' }, { quoted: message });
    }
}

module.exports = githubCommand;
