const axios = require('axios');
const fetch = require('node-fetch');

// ⚠️ Warning: Hardcoding API key is less secure. Later consider using .env file
const OPENAI_API_KEY = 'sk-your_real_openai_key_here';
const SERPER_API_KEY = 'd762702b5efe2f7ed03c51f48f22539e84d2d226';

async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: "Please provide a command: .gpt, .gemini, or .google\nExample: .gpt write a basic html code"
            }, { quoted: message });
        }

        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide text after the command" 
            }, { quoted: message });
        }

        // Show processing reaction
        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });

        // ---- GPT Command ----
        if (command === '.gpt') {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: query }],
                    temperature: 0.7,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const answer = response.data?.choices?.[0]?.message?.content;
            if (answer) {
                await sock.sendMessage(chatId, { text: answer }, { quoted: message });
            } else {
                throw new Error('Invalid GPT response');
            }

        // ---- Gemini Command ----
        } else if (command === '.gemini') {
            const apis = [
                `https://vapis.my.id/api/gemini?q=${encodeURIComponent(query)}`,
                `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(query)}`,
                `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(query)}`,
                `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(query)}`,
                `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(query)}`,
                `https://api.giftedtech.my.id/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(query)}`
            ];
            for (const api of apis) {
                try {
                    const response = await fetch(api);
                    const data = await response.json();
                    const answer = data.message || data.data || data.answer || data.result;
                    if (answer) {
                        await sock.sendMessage(chatId, { text: answer }, { quoted: message });
                        return;
                    }
                } catch (e) {
                    continue;
                }
            }
            throw new Error('All Gemini APIs failed');

        // ---- Google Search Command ----
        } else if (command === '.google') {
            let data = JSON.stringify({ q: query });
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://google.serper.dev/search',
                headers: { 
                    'X-API-KEY': SERPER_API_KEY, 
                    'Content-Type': 'application/json'
                },
                data: data
            };
            const response = await axios.request(config);
            let output = `🔎 Google Search results for "${query}":\n\n`;
            if (response.data?.organic) {
                response.data.organic.slice(0,5).forEach((item, i) => {
                    output += `${i+1}. ${item.title}\n${item.link}\n\n`;
                });
            } else {
                output += 'No results found.';
            }
            await sock.sendMessage(chatId, { text: output }, { quoted: message });
        }

    } catch (error) {
        console.error('AI Command Error:', error);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to get response. Please try again later.",
            contextInfo: {
                mentionedJid: [message.key.participant || message.key.remoteJid],
                quotedMessage: message.message
            }
        }, { quoted: message });
    }
}

module.exports = aiCommand;
