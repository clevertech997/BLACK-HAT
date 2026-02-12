const settings = require('../settings');
const axios = require('axios');

/**
 * Send help message with random image
 * @param {Object} sock - WhatsApp socket
 * @param {string} chatId
 * @param {Object} message - quoted message (optional)
 */
async function helpCommand(sock, chatId, message) {
    const helpMessage = `
╭━❮ *𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻 BOT* ❯━┈⊷
║ 🤖 Bot: ${settings.botName || '𝑩𝑳𝑨𝑪𝑲✦𝑯𝑨𝑻✦'}
║ 👑 Owner: ${settings.botOwner || '𝑨𝒏𝒐𝒏𝒚𝒎𝒐𝒖𝒔 𝑼𝒔𝒆ʀ'}
║ 🛠️ Version: ${settings.version || '3.0.0'}
║ 💻 Platform: Heroku
║ 🌐 Language: Node.js
║ 🎥 YouTube Channel: ${global.ytch || 'Not Set'}
║ 🔧 Features: Premium, AutoReply, Music, Video, News
║ 📡 Status: Online ✅
╰━━━━━━━━━━━━⪼

╭━❮ ⚡ General Commands ❯━┈⊷
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
║ 📸 .ss <link>
║ 🆔 .jid
║ 🔗 .url
╰━━━━━━━━━━━━⪼

╭━❮ 👮‍♂️ Admin Commands ❯━┈⊷
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
║ 🗣️ .getpp
║ 🚫 .antibadword
║ 🧹 .clear
║ 📣 .tag <message>
║ 📢 .tagall
║ 🗣️ .tagnotadmin
║ 🙈 .hidetag <message>
║ 🤖 .chatbot
║ 🔗 .resetlink
║ 🚷 .antitag <on/off>
║ 👋 .welcome <on/off>
║ 👋 .goodbye <on/off>
║ 📝 .setgdesc <description>
║ 🏷️ .setgname <new name>
║ 🖼️ .setgpp (reply to image)
╰━━━━━━━━━━━━⪼

╭━❮ 🔒 Owner Commands ❯━┈⊷
║ 🛠️ .mode <public/private>
║ 🧹 .clearsession
║ 🕵️‍♂️ .antidelete
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

╭━❮ 🎨 Image/Sticker Commands ❯━┈⊷
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

╭━❮ 🖼️ Pies Commands ❯━┈⊷
║ 🌏 .pies <country>
║ 🇨🇳 .china
║ 🇮🇩 .indonesia
║ 🇯🇵 .japan
║ 🇰🇷 .korea
║ 🧕 .hijab
╰━━━━━━━━━━━━⪼

╭━❮ 🎮 Game Commands ❯━┈⊷
║ ❌ .tictactoe @user
║ 🎯 .hangman
║ 🔤 .guess <letter>
║ 🧠 .trivia
║ 💡 .answer <answer>
║ 🤫 .truth
║ 🎲 .dare
╰━━━━━━━━━━━━⪼

╭━❮ 🤖 AI Commands ❯━┈⊷
║ 🧠 .gpt <question>
║ ♊ .gemini <question>
║ 🎨 .imagine <prompt>
║ ⚡ .flux <prompt>
║ 🌀 .sora <prompt>
╰━━━━━━━━━━━━⪼

╭━❮ 🎯 Fun Commands ❯━┈⊷
║ 💌 .compliment @user
║ 🤬 .insult @user
║ 💘 .flirt
║ 📝 .shayari
║ 🌙 .goodnight
║ 🌹 .roseday
║ 👤 .character @user
║ 💀 .wasted @user
║ 💞 .ship @user
║ 🫣 .simp @user
║ 🤡 .stupid @user [text]
╰━━━━━━━━━━━━⪼

╭━❮ 🔤 Textmaker ❯━┈⊷
║ ⚡ .metallic <text>
║ ❄️ .ice <text>
║ ⛄ .snow <text>
║ ✨ .impressive <text>
║ 🟩 .matrix <text>
║ 💡 .light <text>
║ 🔮 .neon <text>
║ 😈 .devil <text>
║ 💜 .purple <text>
║ ⚡ .thunder <text>
║ 🍃 .leaves <text>
║ 🕰️ .1917 <text>
║ 🏟️ .arena <text>
║ 💻 .hacker <text>
║ 🏖️ .sand <text>
║ 🎀 .blackpink <text>
║ 🌀 .glitch <text>
║ 🔥 .fire <text>
╰━━━━━━━━━━━━⪼

╭━❮ 📥 Downloader ❯━┈⊷
║ 🎵 .play <song_name>
║ 🎶 .song <song_name>
║ 🎧 .spotify <query>
║ 📷 .instagram <link>
║ 📘 .facebook <link>
║ 🎵 .tiktok <link>
║ 📹 .video <song name>
║ 🎬 .ytmp4 <Link>
╰━━━━━━━━━━━━⪼

╭━❮ 🧩 MISC ❯━┈⊷
║ 💖 .heart
║ 🔥 .horny
║ 🔵 .circle
║ 🏳️‍🌈 .lgbt
║ 😂 .lolice
║ 🤪 .its-so-stupid
║ 💳 .namecard
║ 🐢 .oogway
║ 🐦 .tweet
║ 📝 .ytcomment
║ ✊ .comrade
║ 🌈 .gay
║ 🔮 .glass
║ 🏛️ .jail
║ ✅ .passed
║ ⚡ .triggered
╰━━━━━━━━━━━━⪼

╭━❮ 🖼️ ANIME ❯━┈⊷
║ 😺 .nom
║ 👆 .poke
║ 😢 .cry
║ 😘 .kiss
║ 👋 .pat
║ 🤗 .hug
║ 😉 .wink
║ 🤦‍♂️ .facepalm
╰━━━━━━━━━━━━⪼

╭━❮ 💻 Github Commands ❯━┈⊷
║ 🔗 .git
║ 🐙 .github
║ 📝 .sc
║ 📜 .script
║ 📦 .repo
╰━━━━━━━━━━━━⪼

🌟 Join our channel for updates!:`;

    // List ya random images
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

    // Chagua random image
    const randomIndex = Math.floor(Math.random() * imageUrls.length);
    const imageUrl = imageUrls[randomIndex];

    try {
        // Download image kama buffer
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: helpMessage,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363422524788798@newsletter',
                    newsletterName: '𝑩𝑳𝑨𝑪𝑲✦𝑯𝑨𝑻✦',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('Error sending help image:', error);

        // Fallback: tuma help message bila image
        await sock.sendMessage(chatId, { 
            text: helpMessage,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363422524788798@newsletter',
                    newsletterName: '𝑩𝑳𝑨𝑪𝑲✦𝑯𝑨𝑻✦ by 𝑨𝒏𝒐𝒏𝒚𝒎𝒐𝒖𝒔 𝑼𝒔𝒆',
                    serverMessageId: -1
                } 
            }
        });
    }
}

module.exports = helpCommand;