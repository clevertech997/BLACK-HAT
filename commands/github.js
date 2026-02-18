const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function githubCommand(sock, chatId, message) {
    try {
        // Fetch repo data
        const res = await fetch('https://api.github.com/repos/clevertech997/BLACK-HAT');
        if (!res.ok) throw new Error(`GitHub API responded with status ${res.status}`);
        const json = await res.json();

        // HUD / plain stats text
        const txt = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷
║ 乂  𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻  乂
╠━━━━━━━━━━━━━━━━━━━━━━━━━━⪼
║ 🕶️ Name       : ${json.name}
║ 💾 Size       : ${(json.size / 1024).toFixed(2)} MB
║ 🕰️ Updated    : ${moment(json.updated_at).tz('Africa/Nairobi').format('DD/MM/YY - HH:mm:ss')}
║ 🔗 URL        : ${json.html_url}
╠━━━━━━━━━━━━━━━━━━━━━━━━━━⪼
║ 👁️ Watchers   : ${json.watchers_count}
║ ⭐ Stars      : ${json.stargazers_count}
║ 🍴 Forks      : ${json.forks_count}
╠━━━━━━━━━━━━━━━━━━━━━━━━━━⪼
║ 💥 乂  𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 乂 💥
╰━━━━━━━━━━━━━━━━━━━━━━━━━━⪼
`;

        // Load local bot image if exists
        const imgPath = path.join(__dirname, '../assets/bot_image.jpg');
        let imgBuffer = null;
        if (fs.existsSync(imgPath)) imgBuffer = fs.readFileSync(imgPath);

        // Send message with image or fallback to text
        await sock.sendMessage(chatId, imgBuffer 
            ? { image: imgBuffer, caption: txt } 
            : { text: txt }, 
            { quoted: message }
        );

    } catch (error) {
        console.error('GitHub HUD Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Error fetching repository information.' }, { quoted: message });
    }
}

module.exports = githubCommand;
