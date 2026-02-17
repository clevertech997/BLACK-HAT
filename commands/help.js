const settings = require('../settings');
const axios = require('axios');

async function helpCommand(sock, chatId, message) {
    const helpMessage = `
╭━❮ *𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻* ❯━┈⊷
║ 🤖 Bot: ${settings.botName || '𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻'}
║ 👑 _Owner_: ${settings.botOwner || '`*_𝑨𝒏𝒐𝒏𝒚𝒎𝒐𝒖𝒔 𝑼𝒔𝒆_*`'}
║ 🛠️ _Version_: ${settings.version || '1.0.0.0'}
║ 💻 _Platform_: *Heroku*
║ 🌐 _Language_: *Node.js*
║ 🎥 _YouTube Channel_: ${global.ytch || 'Not Set'}
║ 🔧 _Features_: *Premium* ✅
║ 📡 _Status_: *Online* 🟢
╰━━━━━━━━━━━━⪼

╭━❮ ⚡ _General Commands_ ❯━┈⊷
║ ✨ .help / .menu
║ ⚡ .ping
║ ❤️ .alive
║ 🗣️ .tts <text>
║ 👤 .owner
║ 😂 .joke
║ 📝 .quote
║ 📚 .fact
║ 🌤️ .weather <city>
║ 📰 .news
║ 🔤 .attp <text>
║ 🎵 .lyrics <song_title>
║ 🎱 .8ball <question>
║ 👥 .groupinfo
║ 🛡️ .staff / .admins
║ 📹 .vv
║ 🌐 .trt <text> <lang>
║ 📸 .ss <url> desktop|mobile
║ 📸 .ss <url> light|dark
║ 🆔 .jid
║ 🔗 .url
╰━━━━━━━━━━━━⪼

╭━❮ 👮‍♂️ _Admin Commands_ ❯━┈⊷
║ ⛔ .ban @user
║ 🆙 .promote @user
║ 🔽 .demote @user
║ 🤫 .mute <minutes>
║ 🔊 .unmute
║ ❌ .delete / .del
║ 👢 .kick @user
║ ⚠️ .warnings @user
║ ⚠️ .warn @user
║ 🚫 .antilink
║ 🚫 .antibadword
║ 🧹 .clear
║ 📸 .getpp
║ 📣 .tag <message>
║ 📢 .tagall
║ 🗣️ .tagnotadmin
║ 🙈 .hidetag <message>
║ 🤖 .chatbot
║ 🤖 .antibot <on/off>
║ 🔗 .resetlink
║ 🚷 .antitag <on/off>
║ 👋 .welcome <on/off>
║ 👋 .goodbye <on/off>
║ 📝 .setgdesc <description>
║ 🏷️ .setgname <new name>
║ 🖼️ .setgpp (reply to image)
╰━━━━━━━━━━━━⪼

╭━❮ 🔒 _Owner Commands_ ❯━┈⊷
║ 🛠️ .mode <public/private>
║ 🧹 .clearsession
║ 📊 .poll
║ 🕵️‍♂️ .antidelete
║ 🗣️ .getpp
║ 🗑️ .cleartmp
║ 🔄 .update
║ ⚙️ .settings
║ 🖼️ .setpp <reply to image>
║ 😎 .autoreact <on/off>
║ 💬 .autostatus <on/off>
║ ✨ .autostatus react <on/off>
║ ⌨️ .autotyping <on/off>
║ 📖 .autoread <on/off>
║ 📵 .anticall <on/off>
║ 🚫 .pmblocker <on/off/status>
║ 📝 .pmblocker setmsg <text>
║ 📌 .setmention <reply to msg>
║ 📍 .mention <on/off>
╰━━━━━━━━━━━━⪼

╭━❮ 🎨 _Image/Sticker Commands_ ❯━┈⊷
║ 🌫️ .blur <image>
║ 🖼️ .simage <reply to sticker>
║ 🖌️ .sticker <reply to image>
║ ✂️ .removebg
║ 🧠 .remini
║ ✂️ .crop <reply to image>
║ 🏷️ .tgsticker <Link>
║ 😂 .meme
║ 🏷️ .take <packname>
║ 😎 .emojimix <emj1>+<emj2>
║ 📷 .igs <insta link>
║ 📸 .igsc <insta link>
╰━━━━━━━━━━━━⪼

╭━❮ 🖼️ _Pies Commands_ ❯━┈⊷
║ 🌍 .pies <country>
║ 🇨🇳 .china
║ 🇮🇩 .indonesia
║ 🇯🇵 .japan
║ 🇰🇷 .korea
║ 🧕 .hijab
╰━━━━━━━━━━━━⪼

╭━❮ 🎮 _Game Commands_ ❯━┈⊷
║ 🎲 .tictactoe @user
║ 🕹️ .hangman
║ ❓ .guess <letter>
║ 🧩 .trivia
║ 💡 .answer <answer>
║ 🤔 .truth
║ 🎯 .dare
╰━━━━━━━━━━━━⪼

╭━❮ 🤖 _AI Commands_ ❯━┈⊷
║ 💬 .gpt <question>
║ 🪐 .gemini <question>
║ 🖌️ .imagine <prompt>
║ 🔮 .flux <prompt>
║ 🧸 .sora <prompt>
╰━━━━━━━━━━━━⪼

╭━❮ 🎯 _Fun Commands_ ❯━┈⊷
║ 💖 .compliment @user
║ 😡 .insult @user
║ 😘 .flirt
║ 💌 .shayari
║ 🌙 .goodnight
║ 🌹 .roseday
║ 👤 .character @user
║ 💀 .wasted @user
║ 💞 .ship @user
║ 🫡 .simp @user
║ 🤪 .stupid @user [text]
╰━━━━━━━━━━━━⪼

╭━❮ 🔤 _Textmaker_ ❯━┈⊷
║ 🪙 .metallic <text>
║ ❄️ .ice <text>
║ 🌨️ .snow <text>
║ 💎 .impressive <text>
║ 🟩 .matrix <text>
║ 💡 .light <text>
║ 🟪 .neon <text>
║ 😈 .devil <text>
║ 💜 .purple <text>
║ ⚡ .thunder <text>
║ 🍃 .leaves <text>
║ 🪖 .1917 <text>
║ 🏟️ .arena <text>
║ 🖤 .hacker <text>
║ 🏖️ .sand <text>
║ 🖤 .blackpink <text>
║ 🟧 .glitch <text>
║ 🔥 .fire <text>
╰━━━━━━━━━━━━⪼

╭━❮ 📥 _Downloader_ ❯━┈⊷
║ 🎵 .play <song_name>
║ 🎶 .song <song_name>
║ 🎧 .spotify <query>
║ 📸 .instagram <link>
║ 🎬 .facebook <link>
║ 🎵 .tiktok <link>
║ 🎥 .video <song_name>
║ 🎞️ .ytmp4 <Link>
╰━━━━━━━━━━━━⪼

╭━❮ 🧩 _MISC_ ❯━┈⊷
║ ❤️ .heart
║ 🔥 .horny
║ ⚪ .circle
║ 🏳️‍🌈 .lgbt
║ 🤡 .lolice
║ 🤪 .its-so-stupid
║ 📝 .namecard
║ 🐢 .oogway
║ 🐦 .tweet
║ 🎬 .ytcomment
║ 🤝 .comrade
║ 🌈 .gay
║ 🥂 .glass
║ 🚔 .jail
║ ✅ .passed
║ 🤯 .triggered
╰━━━━━━━━━━━━⪼

✨ *_Join our channel for updates_*!`;

    const imageUrls = [
        'https://files.catbox.moe/xy39v1.jpg',
        'https://files.catbox.moe/b07g3l.jpg',
        'https://files.catbox.moe/1w2p6m.jpg',
        'https://files.catbox.moe/a20x4m.jpg',
        'https://files.catbox.moe/ksf3fk.jpg',
        'https://files.catbox.moe/kcx25e.jpg',
        'https://files.catbox.moe/9urr8i.jpg',
        'https://files.catbox.moe/5zmu29.jpg',
        'https://files.catbox.moe/8wpfg4.jpg',
        'https://files.catbox.moe/ax9lih.jpg',
        'https://files.catbox.moe/1g814h.jpg'
    ];

    try {
        const randomIndex = Math.floor(Math.random() * imageUrls.length);
        const response = await axios.get(imageUrls[randomIndex], { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: helpMessage,
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
        console.error('Error sending help message with image:', error);
        await sock.sendMessage(chatId, { text: helpMessage });
    }
}

module.exports = helpCommand;
