const axios = require('axios');

module.exports = async function (sock, chatId) {
    try {
        const apiKey = 'dcd720a6f1914e2d9dba9790c188c08c';  // Badilisha na key yako halali
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
        const articles = response.data.articles.slice(0, 5); // Top 5 articles

        if (!articles.length) {
            return await sock.sendMessage(chatId, { text: '❌ No news found right now.' });
        }

        // Tuma kila article kama image + caption
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            const caption = `📰 *${article.title}*\n\n${article.description || ''}\n\n🔗 ${article.url}`;

            if (article.urlToImage) {
                // Tuma kama picha ikiwa ipo
                await sock.sendMessage(chatId, {
                    image: { url: article.urlToImage },
                    caption
                });
            } else {
                // Tuma kama text tu ikiwa hakuna image
                await sock.sendMessage(chatId, { text: caption });
            }
        }

    } catch (error) {
        console.error('Error fetching news:', error);
        await sock.sendMessage(chatId, { text: '❌ Sorry, I could not fetch news right now.' });
    }
};
