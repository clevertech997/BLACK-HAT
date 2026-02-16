const puppeteer = require('puppeteer');

/**
 * Take screenshot of a website
 * @param {import('@whiskeysockets/baileys').WAConnection} sock 
 * @param {string} chatId 
 * @param {object} message 
 * @param {string[]} args - [url, view, theme]
 * view: 'desktop' (default) or 'mobile'
 * theme: 'light' (default) or 'dark'
 */
async function handleSsCommand(sock, chatId, message, args) {
    if (!args || args.length === 0) {
        return await sock.sendMessage(chatId, {
            text: `*SCREENSHOT TOOL*\n\nUsage:\n.ss <url> [desktop|mobile] [light|dark]\n\nExamples:\n.ss https://google.com\n.ss https://google.com mobile dark`,
            quoted: message
        });
    }

    try {
        const url = args[0].trim();
        const view = (args[1] || 'desktop').toLowerCase();
        const theme = (args[2] || 'light').toLowerCase();

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(chatId, {
                text: '❌ Please provide a valid URL starting with http:// or https://',
                quoted: message
            });
        }

        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        // Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set viewport based on device
        if (view === 'mobile') {
            await page.setViewport({ width: 375, height: 812, isMobile: true });
            await page.emulate(puppeteer.devices['iPhone X']);
        } else {
            await page.setViewport({ width: 1280, height: 720 });
        }

        // Set theme using page.evaluate (for websites that respect prefers-color-scheme)
        await page.evaluateOnNewDocument((theme) => {
            const darkMode = theme === 'dark';
            try {
                const meta = document.createElement('meta');
                meta.name = 'color-scheme';
                meta.content = darkMode ? 'dark' : 'light';
                document.head.appendChild(meta);
            } catch(e) {}
        }, theme);

        // Navigate to website
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Take screenshot
        const screenshotBuffer = await page.screenshot({ fullPage: true });

        // Close browser
        await browser.close();

        // Send the screenshot
        await sock.sendMessage(chatId, {
            image: screenshotBuffer,
            caption: `🖥 Screenshot of: ${url}\n👤 View: ${view}\n🎨 Theme: ${theme}`
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in ss command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to take screenshot. Possible reasons:\n• Invalid URL\n• Website blocking screenshots\n• Website down\n• Timeout',
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
};
