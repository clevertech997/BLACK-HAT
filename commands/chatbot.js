const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// In-memory storage for chat history and user info
const chatMemory = {
    messages: new Map(), // last 20 messages per user
    userInfo: new Map()  // Stores user information
};

// --- Load / Save Group Data ---
function loadUserGroupData() {
    try {
        if (!fs.existsSync(USER_GROUP_DATA)) return { groups: [], chatbot: {} };
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
    } catch (err) {
        console.error('❌ Error loading user group data:', err.message);
        return { groups: [], chatbot: {} };
    }
}

function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ Error saving user group data:', err.message);
    }
}

// --- Helpers ---
function getRandomDelay(min = 2000, max = 5000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(res => setTimeout(res, getRandomDelay()));
    } catch (err) {
        console.error('Typing indicator error:', err);
    }
}

function extractUserInfo(message) {
    const info = {};

    const msg = message.toLowerCase();

    // Name
    if (msg.includes('my name is')) {
        info.name = message.split(/my name is/i)[1].trim().split(' ')[0];
    }

    // Age
    const ageMatch = msg.match(/i am (\d{1,3}) years old/);
    if (ageMatch) info.age = ageMatch[1];

    // Location
    if (msg.includes('i live in') || msg.includes('i am from')) {
        info.location = message.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
    }

    return info;
}

// --- Command Handler ---
async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `*CHATBOT SETUP*\n\n*.chatbot on* → Enable chatbot\n*.chatbot off* → Disable chatbot in this group`,
            quoted: message
        });
    }

    const data = loadUserGroupData();
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const senderId = message.key.participant || message.participant || message.pushName || message.key.remoteJid;
    const isOwner = senderId === botNumber;

    let isAdmin = false;
    if (!isOwner && chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            isAdmin = groupMetadata.participants.some(p => p.id === senderId && ['admin', 'superadmin'].includes(p.admin));
        } catch {
            console.warn('⚠️ Could not fetch group metadata. Bot might not be admin.');
        }
    }

    if (!isOwner && !isAdmin) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, { text: '❌ Only group admins or the bot owner can use this command.', quoted: message });
    }

    await showTyping(sock, chatId);

    if (match === 'on') {
        if (data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { text: '*Chatbot is already enabled for this group*', quoted: message });
        }
        data.chatbot[chatId] = true;
        saveUserGroupData(data);
        console.log(`✅ Chatbot enabled for group ${chatId}`);
        return sock.sendMessage(chatId, { text: '*Chatbot has been enabled for this group*', quoted: message });
    }

    if (match === 'off') {
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { text: '*Chatbot is already disabled for this group*', quoted: message });
        }
        delete data.chatbot[chatId];
        saveUserGroupData(data);
        console.log(`✅ Chatbot disabled for group ${chatId}`);
        return sock.sendMessage(chatId, { text: '*Chatbot has been disabled for this group*', quoted: message });
    }

    return sock.sendMessage(chatId, { text: '*Invalid command. Use .chatbot to see usage*', quoted: message });
}

// --- Response Handler ---
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        const botNumber = sock.user.id.split(':')[0];

        // Check if bot is mentioned or replied to
        let isBotMentioned = false;
        let isReplyToBot = false;

        const ext = message.message?.extendedTextMessage;
        if (ext) {
            const mentionedJid = ext.contextInfo?.mentionedJid || [];
            const quotedParticipant = ext.contextInfo?.participant;
            isBotMentioned = mentionedJid.some(jid => jid.split('@')[0] === botNumber);
            isReplyToBot = quotedParticipant?.split(':')[0] === botNumber;
        } else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        let cleanedMessage = userMessage;
        if (isBotMentioned) cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();

        // Initialize memory
        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        // Update user info
        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, { ...chatMemory.userInfo.get(senderId), ...userInfo });
        }

        // Update message history
        const messages = chatMemory.messages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 20) messages.shift();
        chatMemory.messages.set(senderId, messages);

        await showTyping(sock, chatId);

        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        if (!response) {
            return sock.sendMessage(chatId, { text: "Hmm 🤔 I can't think right now. Try again later.", quoted: message });
        }

        await new Promise(res => setTimeout(res, getRandomDelay()));
        await sock.sendMessage(chatId, { text: response, quoted: message });

    } catch (err) {
        console.error('❌ Chatbot response error:', err.message);
        try {
            await sock.sendMessage(chatId, { text: "Oops! 😅 Something went wrong. Please try again.", quoted: message });
        } catch {}
    }
}

// --- AI Integration ---
async function getAIResponse(userMessage, userContext) {
    try {
        const prompt = `
You're chatting on WhatsApp as a real human (Knight Bot).
- Short, casual responses (1-2 lines max)
- Use Hinglish and natural emojis: 😊😂😅🙄😉🥺😎🤔😴
- Respond based on user's tone and context
- Previous conversation: ${userContext.messages.join('\n')}
- User info: ${JSON.stringify(userContext.userInfo, null, 2)}
- Current message: ${userMessage}
`.trim();

        const res = await fetch("https://zellapi.autos/ai/chatbot?text=" + encodeURIComponent(prompt));
        if (!res.ok) throw new Error('AI API call failed');

        const data = await res.json();
        if (!data.status || !data.result) throw new Error('Invalid AI response');

        // Clean response
        return data.result.trim();
    } catch (err) {
        console.error('AI API error:', err);
        return null;
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};
