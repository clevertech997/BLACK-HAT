const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
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
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;

    let commits = '', files = '';
    if (!alreadyUpToDate) {
        commits = await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
        files = await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
        await run(`git reset --hard ${newRev}`);
        await run('git clean -fd');
    }

    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) return reject(new Error('Too many redirects'));
            visited.add(url);

            const client = url.startsWith('https://') ? https : require('http');
            const req = client.get(url, {
                headers: { 'User-Agent': 'BLACKHAT-Updater/1.0', 'Accept': '*/*' }
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const nextUrl = new URL(res.headers.location, url).toString();
                    res.resume();
                    return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
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
        } catch (e) { reject(e); }
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
        await run(cmd); return;
    }
    const unzipCmds = [
        { check: 'command -v unzip', run: cmd => `unzip -o '${zipPath}' -d '${outDir}'` },
        { check: 'command -v 7z', run: cmd => `7z x -y '${zipPath}' -o'${outDir}'` },
        { check: 'busybox unzip -h', run: cmd => `busybox unzip -o '${zipPath}' -d '${outDir}'` }
    ];
    for (const u of unzipCmds) {
        try { await run(u.check); await run(u.run()); return; } catch {}
    }
    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode is recommended.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry), d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        else { fs.copyFileSync(s, d); if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/')); }
    }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) throw new Error('No ZIP URL configured. Set settings.updateZipUrl or UPDATE_ZIP_URL env.');

    const tmpDir = path.join(process.cwd(), 'tmp'); if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);

    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json'];
    const copied = [];

    let preservedOwner = settings.ownerNumber || null;
    let preservedBotOwner = settings.botOwner || null;

    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

    // Restore owner info
    try {
        const settingsPath = path.join(process.cwd(), 'settings.js');
        if (fs.existsSync(settingsPath)) {
            let text = fs.readFileSync(settingsPath, 'utf8');
            if (preservedOwner) text = text.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${preservedOwner}'`);
            if (preservedBotOwner) text = text.replace(/botOwner:\s*'[^']*'/, `botOwner: '${preservedBotOwner}'`);
            fs.writeFileSync(settingsPath, text);
        }
    } catch {}

    // Cleanup
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}

    return { copiedFiles: copied };
}

async function restartProcess(sock, chatId, message) {
    try { await sock.sendMessage(chatId, { text: '✅ Update complete! Restarting…' }, { quoted: message }); } catch {}
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
        await sock.sendMessage(chatId, { text: '🔄 Updating the bot, please wait…' }, { quoted: message });

        if (await hasGitRepo()) {
            const { oldRev, newRev, alreadyUpToDate } = await updateViaGit();
            const summary = alreadyUpToDate ? `✅ Already up to date: ${newRev}` : `✅ Updated to ${newRev}`;
            console.log('[update] Git update summary:', summary);
            await run('npm install --no-audit --no-fund');
            await sock.sendMessage(chatId, { text: summary }, { quoted: message });
        } else {
            const { copiedFiles } = await updateViaZip(sock, chatId, message, zipOverride);
            await sock.sendMessage(chatId, { text: `✅ ZIP update complete. ${copiedFiles.length} files copied.`, quoted: message });
        }

        await restartProcess(sock, chatId, message);
    } catch (err) {
        console.error('Update failed:', err);
        await sock.sendMessage(chatId, { text: `❌ Update failed:\n${err.message || err}` }, { quoted: message });
    }
}

module.exports = updateCommand;
