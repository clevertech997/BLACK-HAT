const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

// Run shell commands
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

// Safe sendMessage
async function safeSend(sock, chatId, message, content) {
    if (sock && chatId && message) {
        try { await sock.sendMessage(chatId, content, { quoted: message }); } catch {}
    }
}

// Restart bot safely (raw Node)
async function restartProcess(sock, chatId, message) {
    await safeSend(sock, chatId, message, { text: '🔄 Restarting bot…' });
    // Give message time to send
    setTimeout(() => {
        process.exit(0); // rely on host to restart bot
    }, 1000);
}

// Update command
async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !isOwner) {
        await safeSend(sock, chatId, message, { text: '❌ Only bot owner or sudo can use .update' });
        return;
    }

    try {
        await safeSend(sock, chatId, message, { text: '🔄 Starting update…' });

        // Check if Git repo
        const gitDir = path.join(process.cwd(), '.git');
        if (fs.existsSync(gitDir)) {
            await safeSend(sock, chatId, message, { text: '🔄 Updating via Git…' });
            const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
            await run('git fetch --all --prune');
            const newRev = (await run('git rev-parse origin/main')).trim();
            if (oldRev !== newRev) {
                await run(`git reset --hard ${newRev}`);
                await run('git clean -fd');
                await safeSend(sock, chatId, message, { text: `✅ Updated to ${newRev}` });
                await run('npm install --no-audit --no-fund');
            } else {
                await safeSend(sock, chatId, message, { text: '✅ Already up to date.' });
            }
        } else {
            // Update via ZIP
            const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
            if (!zipUrl) throw new Error('No ZIP URL configured.');

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const zipPath = path.join(tmpDir, 'update.zip');

            await safeSend(sock, chatId, message, { text: '🔄 Downloading ZIP…' });
            await new Promise((resolve, reject) => {
                const client = zipUrl.startsWith('https://') ? https : http;
                const req = client.get(zipUrl, { headers: { 'User-Agent': 'BLACKHAT-Updater/1.0' } }, res => {
                    if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                    const file = fs.createWriteStream(zipPath);
                    res.pipe(file);
                    file.on('finish', () => file.close(resolve));
                    file.on('error', err => { fs.unlink(zipPath, () => reject(err)); });
                });
                req.on('error', err => fs.unlink(zipPath, () => reject(err)));
            });

            // Extract ZIP
            await safeSend(sock, chatId, message, { text: '🔄 Extracting ZIP…' });
            if (process.platform === 'win32') {
                const zipPathWin = zipPath.replace(/'/g, "''");
                const outDirWin = process.cwd().replace(/'/g, "''");
                await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPathWin}' -DestinationPath '${outDirWin}' -Force"`);
            } else {
                await run(`unzip -o '${zipPath}' -d '${process.cwd()}'`);
            }
            await safeSend(sock, chatId, message, { text: '✅ ZIP update finished.' });
        }

        // Restart bot safely
        await safeSend(sock, chatId, message, { text: '🔄 Restarting bot…' });
        await restartProcess(sock, chatId, message);

    } catch (err) {
        console.error('Update failed:', err);
        await safeSend(sock, chatId, message, { text: `❌ Update failed:\n${String(err.message || err)}` });
    }
}

module.exports = updateCommand;
