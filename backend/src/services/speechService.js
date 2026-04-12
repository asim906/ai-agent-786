// const whisper = require('whisper-node'); // Disabled due to native build issues on Windows
const { MsEdgeTTS } = require('msedge-tts');
const path = require('path');
const fs = require('fs');

const MEDIA_DIR = path.join(__dirname, '..', '..', 'temp_media');

// ── STT Logic (Whisper) ──────────────────────────────────────────────────

async function transcribeAudio(audioPath) {
  try {
    console.log('[speechService] Transcription skipped (local Whisper disabled):', path.basename(audioPath));
    return ''; // Return empty to allow flow to continue without transcription
  } catch (err) {
    console.error('[speechService] STT Error:', err);
    return '';
  }
}

// ── TTS Logic (Edge-TTS) ──────────────────────────────────────────────────────
const tts = new MsEdgeTTS();

async function generateSpeech(text, voice = 'en-US-AndrewNeural') {
  try {
    console.log('[speechService] Generating speech for:', text.substring(0, 30));
    
    const filename = `reply-${Date.now()}.mp3`;
    const outputPath = path.join(MEDIA_DIR, filename);
    
    // msedge-tts uses a different API
    await tts.setMetadata(voice, 'audio-24khz-48kbitrate-mono-mp3');
    
    return new Promise((resolve, reject) => {
      tts.toFile(outputPath, text, (err) => {
        if (err) return reject(err);
        resolve({
          filename,
          filePath: outputPath,
          url: `/media/${filename}`
        });
      });
    });
  } catch (err) {
    console.error('[speechService] TTS Error:', err);
    throw err;
  }
}

/**
 * Returns a list of professional free neural voices
 */
function getAvailableVoices() {
  return [
    { id: 'en-US-AndrewNeural', label: 'Male (Professional)', gender: 'Male' },
    { id: 'en-US-AvaNeural',    label: 'Female (Smooth)',    gender: 'Female' },
    { id: 'en-US-BrianNeural',  label: 'Male (Natural)',     gender: 'Male' },
    { id: 'en-GB-SoniaNeural',  label: 'Female (UK)',        gender: 'Female' },
    { id: 'hi-IN-MadhurNeural', label: 'Male (Hindi)',       gender: 'Male' },
  ];
}

module.exports = { transcribeAudio, generateSpeech, getAvailableVoices };
