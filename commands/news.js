const axios = require('axios');

const fallbackImages = [
    'https://files.catbox.moe/xy39v1.jpg',
    'https://files.catbox.moe/b07g3l.jpg',
    'https://files.catbox.moe/1w2p6m.jpg',
    'https://files.catbox.moe/a20x4m.jpg',
    'https://files.catbox.moe/ksf3fk.jpg',
    'https://files.catbox.moe/kcx25e.jpg'
];

module.exports = async function (sock, chatId) {
    try {
        const apiKey = 'dcd720a6f1914e2d9dba9790c188c08c';  // Replace with your NewsAPI key
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
        const articles = response.data.articles.slice(0, 5); // Top 5 articles

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];

            // Use article image or random fallback
            const imageUrl = article.urlToImage || fallbackImages[Math.floor(Math.random() * fallbackImages.length)];

            // Construct news caption
            let caption = `📰 *Latest News #${i + 1}*\n\n`;
            caption += `📝 *Title:* ${article.title || 'N/A'}\n`;
            caption += `📰 *Description:* ${article.description || 'N/A'}\n`;
            caption += `🔗 *Read more:* ${article.url}\n`;
            caption += `🗓️ *Published At:* ${article.publishedAt ? new Date(article.publishedAt).toLocaleString() : 'N/A'}\n`;

            // Fetch image as buffer
            const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageRes.data, 'binary');

            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: caption,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true
                }
            });
        }
    } catch (error) {
        console.error('Error fetching news:', error);
        await sock.sendMessage(chatId, { text: '❌ Sorry, I could not fetch news right now.' });
    }
};
