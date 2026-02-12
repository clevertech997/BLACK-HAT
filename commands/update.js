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
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

async function updateViaGit() {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune');
    const newRev = (await run('git rev-parse origin/main').catch(() => oldRev)).trim();
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files = alreadyUpToDate ? '' : await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    if (!alreadyUpToDate) {
        await run(`git reset --hard ${newRev}`);
        await run('git clean -fd');
    }
    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

// ====================== Download & ZIP ======================

function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) return reject(new Error('Too many redirects'));
            visited.add(url);

            const client = url.startsWith('https://') ? https : http;
            const req = client.get(url, {
                headers: {
                    'User-Agent': 'BLACK-HATBOT-Updater/1.0', // ⚠ ASCII only
                    'Accept': '*/*'
                }
            }, res => {
                // handle redirects
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    res.resume();
                    return downloadFile(new URL(location, url).toString(), dest, visited).then(resolve).catch(reject);
                }

                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', err => {
                    try { file.close(() => {}); } catch {}
                    fs.unlink(dest, () => reject(err));
                });
            });

            req.on('error', err => fs.unlink(dest, () => reject(err)));
        } catch (e) {
            reject(e);
        }
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`);
        return;
    }

    const tools = [
        { cmd: 'unzip', args: `-o '${zipPath}' -d '${outDir}'` },
        { cmd: '7z', args: `x -y '${zipPath}' -o'${outDir}'` },
        { cmd: 'busybox', args: `unzip -o '${zipPath}' -d '${outDir}'` }
    ];

    for (const t of tools) {
        try {
            await run(`command -v ${t.cmd}`);
            await run(`${t.cmd} ${t.args}`);
            return;
        } catch {}
    }

    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode recommended.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) throw new Error('No ZIP URL configured.');

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);

    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const dirs = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = dirs.length && fs.lstatSync(dirs[0]).isDirectory() ? dirs[0] : extractTo;

    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json'];
    const copied = [];

    let preservedOwner, preservedBotOwner;
    try {
        const currentSettings = require('../settings');
        preservedOwner = currentSettings.ownerNumber ? String(currentSettings.ownerNumber) : null;
        preservedBotOwner = currentSettings.botOwner ? String(currentSettings.botOwner) : null;
    } catch {}

    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

    if (preservedOwner || preservedBotOwner) {
        try {
            const settingsPath = path.join(process.cwd(), 'settings.js');
            if (fs.existsSync(settingsPath)) {
                let text = fs.readFileSync(settingsPath, 'utf8');
                if (preservedOwner) text = text.replace(/ownerNumber:\s*['"][^'"]*['"]/, `ownerNumber: '${preservedOwner}'`);
                if (preservedBotOwner) text = text.replace(/botOwner:\s*['"][^'"]*['"]/, `botOwner: '${preservedBotOwner}'`);
                fs.writeFileSync(settingsPath, text);
            }
        } catch {}
    }

    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    try { delete require.cache[require.resolve('../settings')]; } catch {}

    return { copiedFiles: copied };
}

// ====================== Restart & Command ======================

async function restartProcess(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '✅ Update complete! Restarting…' }, { quoted: message });
    } catch {}
    try {
        await run('pm2 restart all');
        return;
    } catch {}
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
        await sock.sendMessage(chatId, { text: '🔄 Updating the bot, please wait…' }, { quoted: message });

        if (await hasGitRepo()) {
            const { oldRev, newRev, alreadyUpToDate } = await updateViaGit();
            const summary = alreadyUpToDate ? `✅ Already up to date: ${newRev}` : `✅ Updated to ${newRev}`;
            console.log('[update] summary:', summary);
            await run('npm install --no-audit --no-fund');
        } else {
            await updateViaZip(sock, chatId, message, zipOverride);
        }

        try {
            const v = require('../settings').version || '';
            await sock.sendMessage(chatId, { text: `✅ Update done (v${v}). Restarting…` }, { quoted: message });
        } catch {
            await sock.sendMessage(chatId, { text: '✅ Restarted Successfully. Type .ping to check latest version.' }, { quoted: message });
        }

        await restartProcess(sock, chatId, message);
    } catch (err) {
        console.error('Update failed:', err);
        await sock.sendMessage(chatId, { text: `❌ Update failed:\n${String(err.message || err)}` }, { quoted: message });
    }
}

module.exports = updateCommand;
