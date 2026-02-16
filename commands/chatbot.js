const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const USER_MEMORY = path.join(__dirname, '../data/userMemory.json');

// Load or create JSON safely
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

// ----------------------- Memory & Rate Limit -----------------------
const chatMemory = new Map(); // senderId -> { messages: [], lastUsed: timestamp }
const RATE_LIMIT = 5000; // 5 seconds per user

function initUserMemory(senderId) {
    if (!chatMemory.has(senderId)) {
        chatMemory.set(senderId, { messages: [], lastUsed: 0 });
    }
}

function addMessage(senderId, msg) {
    initUserMemory(senderId);
    const userData = chatMemory.get(senderId);
    userData.messages.push(msg);
    if (userData.messages.length > 10) userData.messages.shift(); // Keep last 10 messages
    userData.lastUsed = Date.now();
    chatMemory.set(senderId, userData);
}

// ----------------------- Typing Simulation -----------------------
async function showTyping(sock, chatId, text = '') {
    const delay = 1000 + text.length * 50; // 50ms per character
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(r => setTimeout(r, delay));
    } catch {}
}

// ----------------------- Chatbot Command -----------------------
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

// ----------------------- Chatbot Response -----------------------
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadJSON(USER_GROUP_DATA, { chatbot: {} });
    if (!data.chatbot[chatId]) return;

    initUserMemory(senderId);
    const now = Date.now();
    const userData = chatMemory.get(senderId);
    if (now - userData.lastUsed < RATE_LIMIT) return; // rate limit

    addMessage(senderId, userMessage);

    await showTyping(sock, chatId, userMessage);

    const response = await getAIResponse(userMessage, userData.messages);
    if (!response) return;

    await sock.sendMessage(chatId, { text: response, quoted: message });
}

// ----------------------- AI Request -----------------------
async function getAIResponse(userMessage, contextMessages) {
    try {
        const prompt = `
Chat naturally. Short, casual responses only.
Previous messages:
${contextMessages.join('\n')}
User: ${userMessage}
You:`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(
            "https://zellapi.autos/ai/chatbot?text=" + encodeURIComponent(prompt),
            { signal: controller.signal }
        );

        clearTimeout(timeout);
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.result) return null;

        return data.result.trim();

    } catch (err) {
        console.error("AI API error:", err.message);
        return null;
    }
}

module.exports = { handleChatbotCommand, handleChatbotResponse };
