const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try { await run('git --version'); return true; } catch { return false; }
}

async function updateViaGit(sock, chatId, message) {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await sock.sendMessage(chatId, { text: '🔄 Fetching updates from Git…' }, { quoted: message });
    await run('git fetch --all --prune');
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    await run(`git reset --hard ${newRev}`);
    await run('git clean -fd');
    await sock.sendMessage(chatId, { text: alreadyUpToDate ? '✅ Already up to date.' : `✅ Updated to ${newRev}` }, { quoted: message });
    await sock.sendMessage(chatId, { text: '🔄 Installing dependencies…' }, { quoted: message });
    await run('npm install --no-audit --no-fund');
    return { oldRev, newRev, alreadyUpToDate, commits };
}

function downloadFile(url, dest, visited = new Set(), sock = null, chatId = null, message = null) {
    return new Promise((resolve, reject) => {
        if (visited.has(url) || visited.size > 5) return reject(new Error('Too many redirects'));
        visited.add(url);

        const client = url.startsWith('https://') ? https : http;
        const req = client.get(url, { headers: { 'User-Agent': '𝑩𝑳𝑨𝑪𝑲 𝑯𝑨𝑻-Updater/1.0', 'Accept': '*/*' } }, res => {
            if ([301,302,303,307,308].includes(res.statusCode)) {
                const location = res.headers.location;
                if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                res.resume();
                return downloadFile(new URL(location, url).toString(), dest, visited, sock, chatId, message).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

            if (sock && chatId && message) sock.sendMessage(chatId, { text: '🔄 Downloading ZIP file…' }, { quoted: message });

            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', err => {
                try { file.close(() => {}); } catch {}
                fs.unlink(dest, () => reject(err));
            });
        });
        req.on('error', err => fs.unlink(dest, () => reject(err)));
    });
}

async function extractZip(zipPath, outDir, sock = null, chatId = null, message = null) {
    if (sock && chatId && message) await sock.sendMessage(chatId, { text: '🔄 Extracting ZIP…' }, { quoted: message });
    if (process.platform === 'win32') {
        await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`);
        return;
    }
    const tools = [
        { cmd: 'unzip -v', run: p => run(`unzip -o '${zipPath}' -d '${p}'`) },
        { cmd: '7z', run: p => run(`7z x -y '${zipPath}' -o'${p}'`) },
        { cmd: 'busybox unzip -h', run: p => run(`busybox unzip -o '${zipPath}' -d '${p}'`) }
    ];
    for (const tool of tools) {
        try { await run(`command -v ${tool.cmd.split(' ')[0]}`); await tool.run(outDir); return; } catch {}
    }
    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode is recommended.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        else { fs.copyFileSync(s, d); outList.push(path.join(relative, entry).replace(/\\/g, '/')); }
    }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) throw new Error('No ZIP URL configured.');

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');

    await downloadFile(zipUrl, zipPath, new Set(), sock, chatId, message);

    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo, sock, chatId, message);

    if (sock && chatId && message) await sock.sendMessage(chatId, { text: '🔄 Copying files…' }, { quoted: message });

    const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json'];
    const copied = [];

    // Preserve owner info
    let preservedOwner = null, preservedBotOwner = null;
    try {
        const currentSettings = require('../settings');
        preservedOwner = currentSettings?.ownerNumber ? String(currentSettings.ownerNumber) : null;
        preservedBotOwner = currentSettings?.botOwner ? String(currentSettings.botOwner) : null;
    } catch {}

    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

    if (preservedOwner) {
        try {
            const settingsPath = path.join(process.cwd(), 'settings.js');
            if (fs.existsSync(settingsPath)) {
                let text = fs.readFileSync(settingsPath, 'utf8');
                text = text.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${preservedOwner}'`);
                if (preservedBotOwner) text = text.replace(/botOwner:\s*'[^']*'/, `botOwner: '${preservedBotOwner}'`);
                fs.writeFileSync(settingsPath, text);
            }
        } catch {}
    }

    // Cleanup
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}

    return { copiedFiles: copied };
}

async function restartProcess(sock, chatId, message) {
    if (sock && chatId && message) await sock.sendMessage(chatId, { text: '🔄 Restarting bot…' }, { quoted: message });
    try { await run('pm2 restart all'); return; } catch {}
    setTimeout(() => process.exit(0), 500);
}

async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: '❌ Only bot owner or sudo can use .update' }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, { text: '🔄 Starting update…' }, { quoted: message });

        if (await hasGitRepo()) {
            await updateViaGit(sock, chatId, message);
        } else {
            await updateViaZip(sock, chatId, message, zipOverride);
        }

        if (sock && chatId && message) await sock.sendMessage(chatId, { text: '✅ Update finished, restarting bot…' }, { quoted: message });
        await restartProcess(sock, chatId, message);

    } catch (err) {
        console.error('Update failed:', err);
        await sock.sendMessage(chatId, { text: `❌ Update failed:\n${String(err.message || err)}` }, { quoted: message });
    }
}

module.exports = updateCommand;
