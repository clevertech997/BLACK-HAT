async function dpCommand(sock, chatId, message, number) {
    const jid = `${number}@s.whatsapp.net`;
    try {
        const url = await sock.profilePictureUrl(jid, 'image');
        await sock.sendMessage(chatId, {
            image: { url },
            caption: "📥 Downloaded Profile Picture"
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, {
            text: "❌ Cannot fetch DP."
        }, { quoted: message });
    }
}

module.exports = dpCommand;
