const axios = require('axios');

module.exports = async function (sock, chatId) {
    try {
        const apiKey = 'e9cc48f996234f2b8c636ce152080197'; // weka key yako
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);

        const articles = response.data.articles.slice(0, 5);
        if (!articles.length) {
            return await sock.sendMessage(chatId, { text: '❌ Error fetching news.' });
        }

         
        let newsMessage = '📰 *Latest News*\n\n';

        articles.forEach((article, index) => {
            newsMessage += `*${index + 1}. ${article.title || "No title"}*\n`;
            if (article.description) {
                newsMessage += `${article.description}\n`;
            }
            if (article.url) {
                newsMessage += `🔗 ${article.url}\n`;
            }
            newsMessage += '\n';
        });

         
        const thumbnail = articles[0].urlToImage;

         
        if (thumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: thumbnail },
                caption: newsMessage
            });
        } else {
             
            await sock.sendMessage(chatId, { text: newsMessage });
        }

    } catch (error) {
        console.error('Error fetching news:', error);
        await sock.sendMessage(chatId, { text: '❌ Sorry, I could not fetch news right now.' });
    }
};
