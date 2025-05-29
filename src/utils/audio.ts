import ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, readFileSync } from 'fs';

export const convertOgaToWav = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .format('wav')
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', reject);
  });
};

export const convertWavToOgg = (wavPath: string, oggPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(wavPath)
      .inputFormat('wav')
      .audioCodec('libopus')
      .audioFrequency(48000)
      .audioChannels(1)
      .format('ogg')
      .on('start', (cmd) => console.log('�� FFmpeg started:', cmd))
      .on('error', (err, stdout, stderr) => {
        console.error('❌ FFmpeg error:', err.message);
        reject(err);
      })
      .on('end', () => {
        console.log('✅ Conversion complete:', oggPath);
        resolve();
      })
      .save(oggPath);
  });
};

export const saveBase64ToWav = (base64: string, wavPath: string): void => {
  const buffer = Buffer.from(base64, 'base64');
  writeFileSync(wavPath, buffer);
};

export const readFileAsBase64 = (filePath: string): string => {
  return readFileSync(filePath).toString('base64');
};
