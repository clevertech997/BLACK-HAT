const spamTracker = new Map();

async function handleAntiBotMessages(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId.endsWith('@g.us')) return;

        const data = loadData();
        if (!data[chatId]) return;

        const metadata = await sock.groupMetadata(chatId);
        const sender = message.key.participant;
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (sender === botNumber) return;

        const isAdmin = metadata.participants.some(p => p.id === sender && p.admin);
        const isBotAdmin = metadata.participants.some(p => p.id === botNumber && p.admin);

        if (!isBotAdmin) return;
        if (isAdmin) return;

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!text) return;

        const lowerText = text.toLowerCase();
        const numberOnly = sender.split('@')[0];

        // 🚨 1️⃣ COMMAND DETECTION (.command)
        if (text.trim().startsWith('.')) {
            await punishUser(sock, chatId, sender, message, "Bot not allowed (Fake command)");
            return;
        }

        // 🚨 2️⃣ GROUP LINK
        const groupLinkRegex = /chat\.whatsapp\.com\/[A-Za-z0-9]+/i;
        if (groupLinkRegex.test(lowerText)) {
            await punishUser(sock, chatId, sender, message, "Bot not allowed (Link)");
            return;
        }

        // 🚨 3️⃣ STATUS LINK
        const statusRegex = /wa\.me\/status|whatsapp\.com\/status/i;
        if (statusRegex.test(lowerText)) {
            await punishUser(sock, chatId, sender, message, "Bot not allowed (Status)");
            return;
        }

        // 🚨 4️⃣ BOT NAME DETECTION
        if (lowerText.includes('bot') && lowerText.length < 15) {
            await punishUser(sock, chatId, sender, message, "Bot behaviour detected");
            return;
        }

        // 🚨 5️⃣ SPAM FLOOD DETECTION
        const now = Date.now();
        if (!spamTracker.has(sender)) {
            spamTracker.set(sender, []);
        }

        const timestamps = spamTracker.get(sender);
        timestamps.push(now);

        // Keep only last 5 seconds
        const filtered = timestamps.filter(t => now - t < 5000);
        spamTracker.set(sender, filtered);

        if (filtered.length >= 6) {
            await punishUser(sock, chatId, sender, message, "Spam detected");
            spamTracker.delete(sender);
            return;
        }

        // 🚨 6️⃣ FOREIGN NUMBER AUTO KICK (Optional Tanzania Example)
        if (!numberOnly.startsWith('255')) {
            await punishUser(sock, chatId, sender, message, "Foreign number not allowed");
            return;
        }

    } catch (err) {
        console.error('[ULTRA ANTIBOT ERROR]', err);
    }
}

//
// 🔥 Punish Function (Clean & Safe)
//
async function punishUser(sock, chatId, sender, message, reason) {
    try {
        // Delete message
        await sock.sendMessage(chatId, {
            delete: message.key
        });

        // Warning message
        await sock.sendMessage(chatId, {
            text: `🚨 @${sender.split('@')[0]} removed.\n${reason}`,
            mentions: [sender]
        });

        // Kick
        await sock.groupParticipantsUpdate(chatId, [sender], 'remove');

    } catch (err) {
        console.error('[PUNISH ERROR]', err);
    }
}
