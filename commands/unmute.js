// commands/unmuteCommand.js
async function unmuteCommand(sock, chatId, sender) {
    try {
        // 🔒 Optional: check if sender is owner/admin before unmuting
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        const senderIsAdmin = participants.find(p => p.id === sender)?.admin;

        if (!senderIsAdmin) {
            return await sock.sendMessage(chatId, { 
                text: '❌ You must be an admin to unmute the group.' 
            });
        }

        // 🔊 Unmute the group
        await sock.groupSettingUpdate(chatId, 'not_announcement');

        // ✅ Confirmation message
        await sock.sendMessage(chatId, { 
            text: '✅ The group has been unmuted successfully.' 
        });
    } catch (error) {
        console.error('Error unmuting group:', error);

        await sock.sendMessage(chatId, {
            text: '⚠️ Failed to unmute the group. Please try again later.'
        });
    }
}

module.exports = unmuteCommand;
