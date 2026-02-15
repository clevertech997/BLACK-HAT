const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `*SCREENSHOT TOOL PRO*\n\n*.ss <url>* - Desktop view\n*.ssweb <url>* - Mobile view\n*.ssdark <url>* - Dark mode desktop\n*.ssmobdark <url>* - Dark mode mobile\n*.ssfull <url>* - Full scroll desktop\n*.ssmobfull <url>* - Full scroll mobile\n\nExample:\n.ss https://google.com\n.ssweb https://google.com\n.ssdark https://google.com\n.ssmobdark https://google.com\n.ssfull https://google.com\n.ssmobfull https://google.com`,
            quoted: message
        });
        return;
    }

    try {
        // Typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const [cmd, ...urlParts] = rawText.trim().split(/\s+/);
        const url = urlParts.join(' ').trim();

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(chatId, {
                text: '❌ Please provide a valid URL starting with http:// or https://',
                quoted: message
            });
        }

        await sock.sendMessage(chatId, { text: '🌐 Taking screenshot, please wait...' }, { quoted: message });

        const tmpDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const filePath = path.join(tmpDir, `ss_${Date.now()}.png`);

        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Default settings
        let viewport = { width: 1280, height: 720 };
        let darkMode = false;
        let fullPage = false;

        switch (cmd.toLowerCase()) {
            case '.ssweb':
                viewport = { width: 375, height: 812 }; // Mobile
                break;
            case '.ssdark':
                darkMode = true;
                break;
            case '.ssmobdark':
                viewport = { width: 375, height: 812 };
                darkMode = true;
                break;
            case '.ssfull':
                fullPage = true;
                break;
            case '.ssmobfull':
                viewport = { width: 375, height: 812 };
                fullPage = true;
                break;
        }

        await page.setViewport(viewport);

        if (darkMode) {
            await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
        }

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        await page.screenshot({ path: filePath, fullPage });

        await browser.close();

        const caption = `📸 Screenshot of ${url}\nView: ${viewport.width <= 500 ? 'Mobile' : 'Desktop'}${darkMode ? ' (Dark Mode)' : ''}${fullPage ? ' [Full Scroll]' : ''}`;

        await sock.sendMessage(chatId, {
            image: fs.readFileSync(filePath),
            caption
        }, { quoted: message });

        fs.unlinkSync(filePath);

    } catch (error) {
        console.error('❌ Error in ss command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to take screenshot.\nPossible reasons:\n• Invalid URL\n• Website blocks screenshots\n• Network/Timeout issues',
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
};
