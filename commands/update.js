const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const settings = require('../settings');

// ---------------- RUN SHELL ----------------
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message).toString()));
            resolve((stdout || '').toString());
        });
    });
}

// ---------------- SAFE SEND ----------------
async function safeSend(sock, chatId, message, content) {
    if (!sock || !chatId) return;
    try {
        await sock.sendMessage(chatId, content, { quoted: message });
    } catch (err) {
        console.error("Send error:", err.message);
    }
}

// ---------------- OWNER CHECK ----------------
function isOwnerOrSudo(senderId) {
    if (!senderId) return false;
    const clean = senderId.split('@')[0];

    if (settings.owners?.includes(clean)) return true;
    if (settings.sudo?.includes(clean)) return true;

    return false;
}

// ---------------- DOWNLOAD FILE (FIXED) ----------------
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {

        if (!url || typeof url !== 'string')
            return reject(new Error("Invalid ZIP URL"));

        url = url.trim();
        const client = url.startsWith('https') ? https : http;

        const request = client.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {

            // Handle redirect
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, dest)
                    .then(resolve)
                    .catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`Download failed: ${res.statusCode}`));
            }

            const file = fs.createWriteStream(dest);
            res.pipe(file);

            file.on('finish', () => file.close(resolve));
            file.on('error', err => {
                fs.unlink(dest, () => reject(err));
            });
        });

        request.on('error', err => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

// ---------------- RESTART ----------------
async function restartBot(sock, chatId, message) {
    await safeSend(sock, chatId, message, { text: "🔄 Restarting bot..." });
    setTimeout(() => process.exit(0), 1500);
}

// ---------------- MAIN UPDATE COMMAND ----------------
async function updateCommand(sock, chatId, message) {

    const senderId = message.key.participant || message.key.remoteJid;
    const isPrivate = !chatId.endsWith('@g.us');

    // Owner check
    if (!isOwnerOrSudo(senderId)) {
        return safeSend(sock, chatId, message, {
            text: "🚫 ACCESS DENIED\nOnly verified owner can use this command."
        });
    }

    // Private only security
    if (!isPrivate) {
        return safeSend(sock, chatId, message, {
            text: "⚠️ Update command allowed in private chat only."
        });
    }

    // Secret key check (optional)
    const text = message.message?.conversation || '';
    const args = text.split(" ");
    const providedKey = args[1];

    if (settings.updateKey && providedKey !== settings.updateKey) {
        return safeSend(sock, chatId, message, {
            text: "🔑 Invalid update key."
        });
    }

    try {
        await safeSend(sock, chatId, message, { text: "🔄 Starting update..." });

        const gitFolder = path.join(process.cwd(), '.git');

        // ---------------- GIT UPDATE ----------------
        if (fs.existsSync(gitFolder)) {

            await safeSend(sock, chatId, message, { text: "📦 Updating via Git..." });

            const oldRev = (await run('git rev-parse HEAD').catch(() => "unknown")).trim();
            await run('git fetch --all --prune');
            const newRev = (await run('git rev-parse origin/main')).trim();

            if (oldRev !== newRev) {
                await run(`git reset --hard ${newRev}`);
                await run('git clean -fd');
                await run('npm install --no-audit --no-fund');

                await safeSend(sock, chatId, message, {
                    text: `✅ Updated Successfully\nNew Version:\n${newRev}`
                });
            } else {
                await safeSend(sock, chatId, message, {
                    text: "✅ Already up to date."
                });
            }

        } else {

            // ---------------- ZIP UPDATE ----------------
            const zipUrl = (settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
            if (!zipUrl) throw new Error("No ZIP URL configured.");

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

            const zipPath = path.join(tmpDir, 'update.zip');

            await safeSend(sock, chatId, message, { text: "⬇️ Downloading update..." });
            await downloadFile(zipUrl, zipPath);

            await safeSend(sock, chatId, message, { text: "📂 Extracting update..." });

            if (process.platform === 'win32') {
                await run(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${process.cwd()}' -Force"`);
            } else {
                await run(`unzip -o '${zipPath}' -d '${process.cwd()}'`);
            }

            await run('npm install --no-audit --no-fund');

            await safeSend(sock, chatId, message, {
                text: "✅ ZIP Update Completed Successfully."
            });
        }

        await restartBot(sock, chatId, message);

    } catch (err) {
        console.error("Update failed:", err);
        await safeSend(sock, chatId, message, {
            text: `❌ Update failed:\n${err.message}`
        });
    }
}

module.exports = updateCommand;
