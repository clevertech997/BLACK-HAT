const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

function ensureTempDir() {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    return tempDir;
}

async function downloadAudio(youtubeUrl) {
    return new Promise((resolve, reject) => {
        const tempDir = ensureTempDir();
        const outputFile = path.join(tempDir, `${Date.now()}.mp3`);

        const args = [
            '-x',
            '--audio-format', 'mp3',
            '-o', outputFile,
            youtubeUrl
        ];

        execFile('yt-dlp', args, (error) => {
            if (error) return reject(error);
            if (!fs.existsSync(outputFile)) {
                return reject(new Error('Audio file not found after download'));
            }
            resolve({ path: outputFile });
        });
    });
}

async function downloadVideo(youtubeUrl) {
    return new Promise((resolve, reject) => {
        const tempDir = ensureTempDir();
        const outputFile = path.join(tempDir, `${Date.now()}.mp4`);

        const args = [
            '-f', 'mp4',
            '-o', outputFile,
            youtubeUrl
        ];

        execFile('yt-dlp', args, (error) => {
            if (error) return reject(error);
            if (!fs.existsSync(outputFile)) {
                return reject(new Error('Video file not found after download'));
            }
            resolve({ path: outputFile });
        });
    });
}

module.exports = { downloadAudio, downloadVideo };
