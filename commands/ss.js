// Node 18+ fetch required
import fs from 'fs';
import path from 'path';

async function handleSsCommand(sock, chatId, message, match) {
  try {
    await sock.presenceSubscribe(chatId);
    await sock.sendPresenceUpdate('composing', chatId);

    // ✅ Validate input
    if (!match) {
      return sock.sendMessage(chatId, {
        text: '❌ Please provide a valid URL.\n\nExample:\n.ss https://example.com',
        quoted: message
      });
    }

    const url = match.trim();
    if (!/^https?:\/\//i.test(url)) {
      return sock.sendMessage(chatId, {
        text: '❌ URL must start with http:// or https://',
        quoted: message
      });
    }

    // 🔗 Fetch screenshot from PageShot API (no API key required)
    const response = await fetch('https://pageshot.site/v1/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        width: 1280,
        height: 720,
        format: 'png',
        full_page: true
      })
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());

    // 📤 Send screenshot directly without saving
    await sock.sendMessage(chatId, {
      image: buffer,
      caption: `📸 Screenshot of ${url} via PageShot API`
    }, { quoted: message });

    console.log(`Captured in ${response.headers.get('X-Screenshot-Time')} ms`);

  } catch (error) {
    console.error('❌ Error in .ss command:', error);
    await sock.sendMessage(chatId, {
      text: '❌ Failed to capture screenshot. Make sure the URL is correct.',
      quoted: message
    });
  }
}

export { handleSsCommand };
