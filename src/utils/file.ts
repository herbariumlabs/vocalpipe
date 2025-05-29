import { existsSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export const generateUniqueId = (): string => {
  return uuidv4();
};

export const generateFilePaths = (id: string) => {
  const tempDir = config.tempDir;
  return {
    ogaPath: `${tempDir}/${id}.oga`,
    wavPath: `${tempDir}/${id}.wav`,
    oggPath: `${tempDir}/${id}.ogg`,
  };
};

export const cleanupFiles = (filePaths: string[]): void => {
  filePaths.forEach((filePath) => {
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
        console.log(`🗑️ Cleaned up: ${filePath}`);
      } catch (error) {
        console.error(`❌ Failed to cleanup ${filePath}:`, error);
      }
    }
  });
};

export const ensureDirectoryExists = (dirPath: string): void => {
  const fs = require('fs');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};
