async function unmuteCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            "";

        const args = text.trim().split(/\s+/);

        // Check if user provided minutes
        if (!args[1]) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Please provide the duration in minutes.\nExample: .unmute 10"
            }, { quoted: message });
        }

        const duration = Number(args[1]);

        // Validate the number
        if (isNaN(duration) || duration <= 0) {
            return await sock.sendMessage(chatId, {
                text: "❌ Please provide a valid number of minutes."
            }, { quoted: message });
        }

        // Unmute the group
        await sock.groupSettingUpdate(chatId, 'not_announcement');

        await sock.sendMessage(chatId, {
            text: `✅ The group has been unmuted for ${duration} minute(s).`
        });

        // Automatically mute again after the specified time
        setTimeout(async () => {
            try {
                await sock.groupSettingUpdate(chatId, 'announcement');
                await sock.sendMessage(chatId, {
                    text: `🔒 The group has been muted again after ${duration} minute(s).`
                });
            } catch (err) {
                console.error("Auto mute error:", err);
            }
        }, duration * 60 * 1000);

    } catch (error) {
        console.error("Error in unmuteCommand:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to unmute the group."
        });
    }
}

module.exports = unmuteCommand;
