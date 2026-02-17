const fs = require('fs');
const path = require('path');
const axios = require('axios');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// -------------------- JSON Helpers --------------------
function loadJSON(file, defaultValue = {}) {
    try {
        if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw || '{}');
    } catch {
        return defaultValue;
    }
}

function saveJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
}

// -------------------- Memory & Rate Limit --------------------
const chatMemory = new Map(); // chatId -> [{ role: 'user'/'assistant', content }]
const RATE_LIMIT = 5000;

function initChatMemory(chatId) {
    if (!chatMemory.has(chatId)) chatMemory.set(chatId, []);
}

function addMessageToMemory(chatId, role, content) {
    initChatMemory(chatId);
    const messages = chatMemory.get(chatId);
    messages.push({ role, content });
    if (messages.length > 50) messages.shift(); // keep last 50 messages
    chatMemory.set(chatId, messages);
}

// -------------------- Typing Simulation --------------------
async function showTyping(sock, chatId, text = '') {
    const delay = 1000 + text.length * 50;
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(r => setTimeout(r, delay));
    } catch {}
}

// -------------------- Chatbot Command --------------------
async function handleChatbotCommand(sock, chatId, message, match) {
    const data = loadJSON(USER_GROUP_DATA, { chatbot: {} });
    const senderId = message.key.participant || message.participant || message.key.remoteJid;
    const botId = sock.user.id.split(':')[0];

    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `*CHATBOT COMMANDS*\n\n*.chatbot on* - Enable chatbot\n*.chatbot off* - Disable chatbot`,
            quoted: message
        });
    }

    const isOwner = senderId === botId + '@s.whatsapp.net';
    let isAdmin = false;

    if (chatId.endsWith('@g.us')) {
        try {
            const groupMeta = await sock.groupMetadata(chatId);
            isAdmin = groupMeta.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch {}
    }

    if (!isOwner && !isAdmin) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, { text: '❌ Only admins or owner can use this command.', quoted: message });
    }

    if (match === 'on') {
        data.chatbot[chatId] = true;
        saveJSON(USER_GROUP_DATA, data);
        return sock.sendMessage(chatId, { text: '✅ Chatbot enabled for this group', quoted: message });
    }

    if (match === 'off') {
        delete data.chatbot[chatId];
        saveJSON(USER_GROUP_DATA, data);
        return sock.sendMessage(chatId, { text: '❌ Chatbot disabled for this group', quoted: message });
    }

    await sock.sendMessage(chatId, { text: '❌ Invalid command. Use .chatbot', quoted: message });
}

// -------------------- Chatbot Response (Multi-turn) --------------------
const OPENAI_API_KEY = 'sk-1234uvwxabcd5678uvwxabcd1234uvwxabcd5678';

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadJSON(USER_GROUP_DATA, { chatbot: {} });
    if (!data.chatbot[chatId]) return;

    initChatMemory(chatId);
    const messages = chatMemory.get(chatId);
    const now = Date.now();
    if (messages.length > 0 && now - (messages[messages.length-1].timestamp || 0) < RATE_LIMIT) return;

    addMessageToMemory(chatId, 'user', userMessage);

    await showTyping(sock, chatId, userMessage);

    const aiResponse = await getAIResponse(chatId);
    if (!aiResponse) return;

    addMessageToMemory(chatId, 'assistant', aiResponse);

    await sock.sendMessage(chatId, { text: aiResponse, quoted: message });
}

// -------------------- GPT Request --------------------
async function getAIResponse(chatId) {
    try {
        const messages = chatMemory.get(chatId) || [];
        // convert to OpenAI format
        const openAIMessages = messages.map(m => ({ role: m.role, content: m.content }));

        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: openAIMessages,
                temperature: 0.7,
                max_tokens: 300
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        const result = res.data?.choices?.[0]?.message?.content;
        return result ? result.trim() : null;
    } catch (err) {
        console.error("GPT API error:", err.message);
        return null;
    }
}

module.exports = { handleChatbotCommand, handleChatbotResponse };
