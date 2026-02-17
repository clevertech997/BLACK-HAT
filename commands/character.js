const { channelInfo } = require('../lib/messageConfig');

async function characterCommand(sock, chatId, message) {
    let userToAnalyze;

    // 👀 Determine target user
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToAnalyze = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToAnalyze = message.message.extendedTextMessage.contextInfo.participant;
    }

    if (!userToAnalyze) {
        await sock.sendMessage(chatId, {
            text: '⚠ Please mention someone or reply to their message to analyze their character!',
            ...channelInfo
        });
        return;
    }

    try {
        // 📸 Profile picture
        let profilePic;
        try {
            profilePic = await sock.profilePictureUrl(userToAnalyze, 'image');
        } catch {
            profilePic = 'https://i.imgur.com/2wzGhpF.jpeg'; // fallback
        }

        // 🎯 Traits pool (50+)
        const traits = [
            "Intelligent", "Creative", "Determined", "Ambitious", "Caring",
            "Charismatic", "Confident", "Empathetic", "Energetic", "Friendly",
            "Generous", "Honest", "Humorous", "Imaginative", "Independent",
            "Intuitive", "Kind", "Logical", "Loyal", "Optimistic",
            "Passionate", "Patient", "Persistent", "Reliable", "Resourceful",
            "Sincere", "Thoughtful", "Understanding", "Versatile", "Wise",
            "Adventurous", "Brave", "Calm", "Cheerful", "Compassionate",
            "Considerate", "Courageous", "Curious", "Diligent", "Easygoing",
            "Enthusiastic", "Flexible", "Forgiving", "Friendly", "Fun-loving",
            "Generous", "Gentle", "Grateful", "Honorable", "Innovative"
        ];

        // 🎲 Randomly select 5-8 traits
        const numTraits = Math.floor(Math.random() * 4) + 5; // 5-8 traits
        const selectedTraits = [];
        while (selectedTraits.length < numTraits) {
            const t = traits[Math.floor(Math.random() * traits.length)];
            if (!selectedTraits.includes(t)) selectedTraits.push(t);
        }

        // ⚡ Assign random percentages (50-100)
        const traitPercentages = selectedTraits.map(trait => {
            return `${trait}: ${Math.floor(Math.random() * 51) + 50}%`;
        });

        // 🔹 Fun stats
        const mood = ["😄 Happy","😎 Confident","😌 Calm","🤔 Thoughtful","😂 Funny","🤩 Excited"];
        const energy = Math.floor(Math.random() * 51) + 50; // 50-100%
        const intelligence = Math.floor(Math.random() * 51) + 50;
        const creativity = Math.floor(Math.random() * 51) + 50;
        const luck = Math.floor(Math.random() * 51) + 50;
        const overall = Math.floor((energy + intelligence + creativity + luck)/4);

        // ✨ Build message
        const analysis = `🔮 *Character Analysis* 🔮\n\n` +
            `👤 *User:* ${userToAnalyze.split('@')[0]}\n\n` +
            `✨ *Key Traits:*\n${traitPercentages.join('\n')}\n\n` +
            `🎭 *Mood:* ${mood[Math.floor(Math.random()*mood.length)]}\n` +
            `⚡ *Energy:* ${energy}% | 🧠 *Intelligence:* ${intelligence}%\n` +
            `🎨 *Creativity:* ${creativity}% | 🍀 *Luck:* ${luck}%\n` +
            `🎯 *Overall Rating:* ${overall}%\n\n` +
            `Note: This is a fun analysis and should not be taken seriously!`;

        // 📩 Send message
        await sock.sendMessage(chatId, {
            image: { url: profilePic },
            caption: analysis,
            mentions: [userToAnalyze],
            ...channelInfo
        });

    } catch (error) {
        console.error('[CHARACTER COMMAND ERROR]', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to analyze character! Try again later.',
            ...channelInfo
        });
    }
}

module.exports = characterCommand;
