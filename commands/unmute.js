async function unmuteCommand(sock, chatId) {
    await sock.groupSettingUpdate(chatId, '_not_announcement_'); // Unmute the group
    await sock.sendMessage(chatId, { text: '_The group has been unmuted_.' });
}

module.exports = unmuteCommand;
