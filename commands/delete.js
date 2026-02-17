const isAdmin = require('../lib/isAdmin');
const store = require('../lib/lightweight_store');

async function deleteCommand(sock, chatId, message, senderId) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            return await sock.sendMessage(chatId, { text: 'I need to be an admin to delete messages.' }, { quoted: message });
        }

        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, { text: 'Only admins can use the .delete command.' }, { quoted: message });
        }

        // Extract text and arguments
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        let count = parts.length > 1 ? parseInt(parts[1], 10) : null;
        if (isNaN(count) || count <= 0) count = null;
        if (count !== null) count = Math.min(count, 50); // Max 50 messages

        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        const repliedParticipant = ctxInfo.participant || null;
        const mentioned = Array.isArray(ctxInfo.mentionedJid) && ctxInfo.mentionedJid.length > 0 ? ctxInfo.mentionedJid[0] : null;

        // Determine defaults
        if (count === null) {
            if (repliedParticipant || mentioned) count = 1;
            else return await sock.sendMessage(chatId, {
                text: '❌ Please specify the number of messages to delete.\n\nUsage:\n• `.del 5` - Delete last 5 messages from group\n• `.del 3 @user` - Delete last 3 messages from @user\n• `.del 2` (reply to message) - Delete last 2 messages from replied user'
            }, { quoted: message });
        }

        let targetUser = repliedParticipant || mentioned || null;
        const deleteGroupMessages = !targetUser;
        const repliedMsgId = ctxInfo.stanzaId || null;

        const chatMessages = Array.isArray(store.messages[chatId]) ? store.messages[chatId] : [];
        const toDelete = [];
        const seenIds = new Set();

        if (deleteGroupMessages) {
            // Delete last N messages from the group (any user)
            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < count; i--) {
                const m = chatMessages[i];
                if (!seenIds.has(m.key.id) && !m.message?.protocolMessage && !m.key.fromMe && m.key.id !== message.key.id) {
                    toDelete.push(m);
                    seenIds.add(m.key.id);
                }
            }
        } else {
            // Delete messages from a specific user
            if (repliedMsgId) {
                const repliedMsg = chatMessages.find(m => m.key.id === repliedMsgId && (m.key.participant || m.key.remoteJid) === targetUser);
                if (repliedMsg) {
                    toDelete.push(repliedMsg);
                    seenIds.add(repliedMsg.key.id);
                } else {
                    // Attempt direct delete if not in store
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: false,
                                id: repliedMsgId,
                                participant: repliedParticipant
                            }
                        });
                        count = Math.max(0, count - 1);
                    } catch {}
                }
            }

            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < count; i--) {
                const m = chatMessages[i];
                const participant = m.key.participant || m.key.remoteJid;
                if (participant === targetUser && !seenIds.has(m.key.id) && !m.message?.protocolMessage) {
                    toDelete.push(m);
                    seenIds.add(m.key.id);
                }
            }
        }

        if (!toDelete.length) {
            const msg = deleteGroupMessages ? 'No recent messages found in the group to delete.' : 'No recent messages found for the target user.';
            return await sock.sendMessage(chatId, { text: msg }, { quoted: message });
        }

        // Delete messages sequentially with a small delay
        for (const m of toDelete) {
            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: m.key.id,
                        participant: deleteGroupMessages ? (m.key.participant || m.key.remoteJid) : targetUser
                    }
                });
                await new Promise(res => setTimeout(res, 300));
            } catch {}
        }

    } catch (err) {
        await sock.sendMessage(chatId, { text: 'Failed to delete messages.' }, { quoted: message });
    }
}

module.exports = deleteCommand;
