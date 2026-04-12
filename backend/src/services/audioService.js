const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// Setup local ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const MEDIA_DIR = path.join(__dirname, '..', '..', 'temp_media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

/**
 * Downloads WhatsApp media (audio, image, etc) and saves it to a temp file
 * @param {Object} msg - The Baileys message object
 * @param {string} type - 'audio' | 'image' | 'video' | 'document'
 * @param {string} prefix - Filename prefix
 */
async function downloadMedia(msg, type = 'audio', prefix = 'media') {
  try {
    const mediaMsg = msg.message?.[`${type}Message`];
    if (!mediaMsg) throw new Error(`No ${type} message found in the object`);

    console.log(`[audioService] ${type} message received from WhatsApp`);

    const stream = await downloadContentFromMessage(mediaMsg, type);
    
    // Determine extension
    let ext = 'bin';
    if (type === 'audio') ext = 'ogg';
    else if (type === 'image') ext = 'jpg';
    else if (type === 'video') ext = 'mp4';
    
    const filename = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(MEDIA_DIR, filename);
    
    await pipeline(stream, fs.createWriteStream(filePath));
    console.log(`[audioService] ${type} downloaded:`, filename);
    
    return { filename, filePath };
  } catch (err) {
    console.error(`[audioService] download error for ${type}:`, err);
    throw err;
  }
}

/**
 * Transcodes audio to a different format (usually ogg -> mp3)
 */
async function transcodeAudio(inputPath, outputExt = 'mp3') {
  const outputPath = inputPath.replace(/\.[^.]+$/, `.${outputExt}`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat(outputExt)
      .audioBitrate('128k') // Ensure decent quality
      .on('error', (err) => {
        console.error('[audioService] ffmpeg error:', err);
        reject(err);
      })
      .on('end', () => {
        console.log('[audioService] Audio converted and accessible:', path.basename(outputPath));
        resolve({ 
          filePath: outputPath, 
          filename: path.basename(outputPath) 
        });
      })
      .save(outputPath);
  });
}

function getExtension(msg) {
  const type = Object.keys(msg.message || {})[0];
  if (type === 'audioMessage') return 'ogg';
  if (type === 'imageMessage') return 'jpg';
  if (type === 'videoMessage') return 'mp4';
  return 'bin';
}

/**
 * Cleanup old media files (older than 24h)
 */
function cleanupMedia() {
  const files = fs.readdirSync(MEDIA_DIR);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;

  files.forEach(file => {
    const filePath = path.join(MEDIA_DIR, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
    }
  });
}

// Run cleanup every 6 hours
setInterval(cleanupMedia, 6 * 60 * 60 * 1000);

module.exports = { downloadMedia, transcodeAudio };
