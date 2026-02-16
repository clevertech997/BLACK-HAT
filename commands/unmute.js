async function unmuteCommand(sock, chatId, message) {
    try {
        // Extract duration from message, default to 23 minutes
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let duration = 23; // default in minutes

        if (text) {
            const parts = text.trim().split(' ');
            if (parts.length > 1) {
                const parsed = parseInt(parts[1], 10);
                if (!isNaN(parsed) && parsed > 0) {
                    duration = parsed;
                }
            }
        }

        // Unmute the group
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: `✅ The group has been unmuted for ${duration} minute(s).` });

        // Set timeout to mute group again after duration
        setTimeout(async () => {
            try {
                await sock.groupSettingUpdate(chatId, 'announcement'); // Mute
                await sock.sendMessage(chatId, { text: `🔒 The group has been muted again after ${duration} minute(s).` });
            } catch (muteError) {
                console.error("Failed to mute group after timeout:", muteError);
            }
        }, duration * 60 * 1000);

    } catch (error) {
        console.error("Error in unmuteCommand:", error);
        await sock.sendMessage(chatId, { text: '❌ Failed to unmute the group.' });
    }
}

module.exports = unmuteCommand;
