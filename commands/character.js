const fs = require('fs');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');

const memoryPath = path.join(__dirname, '..', 'data', 'characterMemory.json');

// ─── Memory Handlers ──────────────────────────────────────────────────────────
function loadMemory() {
    try {
        if (!fs.existsSync(memoryPath)) {
            fs.writeFileSync(memoryPath, JSON.stringify({}, null, 2));
        }
        const data = fs.readFileSync(memoryPath, 'utf8').trim();
        if (!data) return {};
        return JSON.parse(data);
    } catch (err) {
        console.error('Memory JSON parse error, resetting memory:', err);
        fs.writeFileSync(memoryPath, JSON.stringify({}, null, 2));
        return {};
    }
}

function saveMemory(data) {
    fs.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
}

// ─── Stats Generation & Evolution ─────────────────────────────────────────────
function randStat(min = 70, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStats() {
    return {
        energy: randStat(),
        intelligence: randStat(),
        creativity: randStat(),
        luck: randStat()
    };
}

function evolveStats(stats) {
    return Object.fromEntries(
        Object.entries(stats).map(([key, value]) => {
            const increment = Math.floor(Math.random() * 5) + 1;
            return [key, Math.min(value + increment, 100)];
        })
    );
}

// ─── Mood & Reputation ───────────────────────────────────────────────────────
function calculateMood(stats) {
    const avg = Object.values(stats).reduce((a, b) => a + b, 0) / 4;
    if (avg >= 90) return "🤩 Excited";
    if (avg >= 80) return "😎 Confident";
    if (avg >= 70) return "😌 Calm";
    if (avg >= 60) return "😄 Happy";
    return "🤔 Thoughtful";
}

function calculateReputation(level, luck) {
    const score = level * 10 + luck;
    if (score >= 200) return "⭐⭐⭐⭐ Excellent";
    if (score >= 150) return "⭐⭐⭐ Good";
    if (score >= 100) return "⭐⭐ Average";
    return "⭐ Poor";
}

// ─── Trait Initialization ────────────────────────────────────────────────────
function assignTraits() {
    const traitsPool = [
        "Intelligent","Creative","Loyal","Confident","Ambitious",
        "Calm","Charismatic","Brave","Kind","Strategic",
        "Optimistic","Independent","Wise","Energetic","Focused"
    ];
    return traitsPool.sort(() => 0.5 - Math.random()).slice(0, 6);
}

// ─── Character Command ───────────────────────────────────────────────────────
async function characterCommand(sock, chatId, message) {
    try {
        const context = message.message?.extendedTextMessage?.contextInfo;
        const user = context?.mentionedJid?.[0] || context?.participant;

        if (!user) return await sock.sendMessage(chatId, {
            text: '⚠ Mention someone or reply to analyze.',
            ...channelInfo
        });

        const memory = loadMemory();
        const now = Date.now();

        if (!memory[user]) {
            // Initialize new character
            memory[user] = {
                traits: assignTraits(),
                stats: generateStats(),
                level: 1,
                uses: 1,
                lastUsed: now,
                mood: "😄 Happy",
                reputation: "⭐ Poor"
            };
        } else {
            // Evolve existing character
            const char = memory[user];
            char.stats = evolveStats(char.stats);
            char.uses += 1;
            if (char.uses % 5 === 0) char.level += 1;

            char.mood = calculateMood(char.stats);
            char.reputation = calculateReputation(char.level, char.stats.luck);
            char.lastUsed = now;
        }

        saveMemory(memory);
        const data = memory[user];

        const overall = Math.floor(Object.values(data.stats).reduce((a,b) => a + b, 0) / 4);

        // Try fetching profile picture
        let profilePic;
        try {
            profilePic = await sock.profilePictureUrl(user, 'image');
        } catch {
            profilePic = 'https://i.imgur.com/2wzGhpF.jpeg';
        }

        // ─── Caption / BLACK HAT Style ───────────────────────────────
        const caption =
`╭━❮_🧬 CHARACTER EVOLUTION_❯━┈⊷
│ 👤 User: ${user.split('@')[0]}
│ 🏆 Level: ${data.level} | Uses: ${data.uses}
│ 🕒 Last Used: ${new Date(data.lastUsed).toLocaleDateString()}
╰━━━━━━━━━━━━━━⪼

✨ Traits:
${data.traits.map(t => `• ${t}`).join('\n')}

⚡ Energy: ${data.stats.energy}%
🧠 Intelligence: ${data.stats.intelligence}%
🎨 Creativity: ${data.stats.creativity}%
🍀 Luck: ${data.stats.luck}%

🎭 Mood: ${data.mood}
🏅 Reputation: ${data.reputation}
🏆 Overall Score: ${overall}%
⚠ Fun analysis. Stats evolve over time!
╰━━━━━━━━━━━━━━⪼`;

        await sock.sendMessage(chatId, {
            image: { url: profilePic },
            caption,
            mentions: [user],
            ...channelInfo
        });

    } catch (err) {
        console.error('Character Evolution Error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to analyze character. Try again later.',
            ...channelInfo
        });
    }
}

module.exports = characterCommand;
