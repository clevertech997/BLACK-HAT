async function updateViaZip(sock, chatId, message, zipOverride) {
    // Normalize and encode URL
    const zipUrlRaw = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrlRaw) throw new Error('No ZIP URL configured.');
    let zipUrl;
    try {
        zipUrl = encodeURI(zipUrlRaw);
    } catch {
        throw new Error('Invalid ZIP URL.');
    }

    // Prepare temporary directories
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, 'update.zip');

    // Download ZIP
    await downloadFile(zipUrl, zipPath);

    // Prepare extraction directory
    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });

    // Helper: safely escape paths for shell commands
    const escapePathForShell = (p) => p.replace(/'/g, "''");

    // Extract ZIP
    const zipPathEscaped = escapePathForShell(zipPath);
    const extractToEscaped = escapePathForShell(extractTo);

    if (process.platform === 'win32') {
        await run(
            `powershell -NoProfile -Command "Expand-Archive -Path '${zipPathEscaped}' -DestinationPath '${extractToEscaped}' -Force"`
        );
    } else {
        const tools = [
            { cmd: 'unzip -v', runCmd: `unzip -o '${zipPathEscaped}' -d '${extractToEscaped}'` },
            { cmd: '7z', runCmd: `7z x -y '${zipPathEscaped}' -o'${extractToEscaped}'` },
            { cmd: 'busybox unzip -h', runCmd: `busybox unzip -o '${zipPathEscaped}' -d '${extractToEscaped}'` }
        ];

        let extracted = false;
        for (const tool of tools) {
            try {
                await run(`command -v ${tool.cmd.split(' ')[0]}`);
                await run(tool.runCmd);
                extracted = true;
                break;
            } catch {}
        }

        if (!extracted) throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode recommended.");
    }

    // Determine root folder inside extracted ZIP
    const rootDirs = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = rootDirs[0] && fs.lstatSync(rootDirs[0]).isDirectory() ? rootDirs[0] : extractTo;

    // Files/folders to ignore
    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json'];
    const copied = [];

    // Preserve owner info
    let preservedOwner = null, preservedBotOwner = null;
    try {
        const currentSettings = require('../settings');
        preservedOwner = currentSettings?.ownerNumber ? String(currentSettings.ownerNumber) : null;
        preservedBotOwner = currentSettings?.botOwner ? String(currentSettings.botOwner) : null;
    } catch {}

    // Recursive copy function
    function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
            if (ignore.includes(entry)) continue;
            const s = path.join(src, entry);
            const d = path.join(dest, entry);
            const stat = fs.lstatSync(s);
            if (stat.isDirectory()) copyRecursive(s, d, ignore, path.join(relative, entry), outList);
            else { fs.copyFileSync(s, d); if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/')); }
        }
    }

    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

    // Restore owner info in settings
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

    // Cleanup temporary files
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}

    return { copiedFiles: copied };
}
