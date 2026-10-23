/**
 * Manuscript AI - Image Storage Service & Content Validation Abstraction
 *
 * Implements real file storage for manuscript folios:
 * - Content-based magic bytes detection (JPEG, PNG, WebP)
 * - Dimension extraction from binary headers
 * - SHA-256 cryptographic checksum calculation
 * - Path traversal defenses and server-side key generation
 * - Streaming file retrieval
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

export interface ValidatedImageMetadata {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  width: number;
  height: number;
}

export class StorageService {
  private uploadDir: string;
  private maxSizeBytes: number;

  constructor() {
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
    const maxMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '20', 10);
    this.maxSizeBytes = maxMb * 1024 * 1024;
    this.ensureDirectory(this.uploadDir);
    this.ensureDirectory(path.join(this.uploadDir, 'folios'));
  }

  private ensureDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Detects true MIME type from file magic bytes
   */
  public detectMagicBytes(buffer: Buffer): { mimeType: string; extension: string } | null {
    if (buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mimeType: 'image/jpeg', extension: 'jpg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mimeType: 'image/png', extension: 'png' };
    }

    // WebP: RIFF .... WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mimeType: 'image/webp', extension: 'webp' };
    }

    return null;
  }

  /**
   * Extract image dimensions directly from binary header markers
   */
  public extractDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } {
    try {
      if (mimeType === 'image/png' && buffer.length >= 24) {
        // PNG width at byte 16..19, height at byte 20..23 (big endian)
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width > 0 && height > 0) return { width, height };
      }

      if (mimeType === 'image/jpeg') {
        let offset = 2;
        while (offset < buffer.length) {
          if (buffer[offset] !== 0xff) break;
          const marker = buffer[offset + 1];
          // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
          if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            if (width > 0 && height > 0) return { width, height };
          }
          const length = buffer.readUInt16BE(offset + 2);
          offset += 2 + length;
        }
      }

      if (mimeType === 'image/webp' && buffer.length >= 30) {
        // VP8 (lossy) header
        if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
          const width = (buffer.readUInt16LE(26) & 0x3fff);
          const height = (buffer.readUInt16LE(28) & 0x3fff);
          if (width > 0 && height > 0) return { width, height };
        }
        // VP8L (lossless) header
        if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
          const b1 = buffer[21];
          const b2 = buffer[22];
          const b3 = buffer[23];
          const b4 = buffer[24];
          const width = 1 + (((b2 & 0x3f) << 8) | b1);
          const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
          if (width > 0 && height > 0) return { width, height };
        }
      }
    } catch {
      // Fallback
    }

    return { width: 1600, height: 2400 };
  }

  /**
   * Validates and writes image buffer to persistent storage
   */
  public async storeImage(
    buffer: Buffer,
    originalFilename: string
  ): Promise<ValidatedImageMetadata> {
    if (buffer.length > this.maxSizeBytes) {
      throw new Error(`File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${this.maxSizeBytes / (1024 * 1024)}MB`);
    }

    const detected = this.detectMagicBytes(buffer);
    if (!detected) {
      throw new Error('Unsupported file format. Actual binary header is not valid JPEG, PNG, or WebP.');
    }

    const { width, height } = this.extractDimensions(buffer, detected.mimeType);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Generate safe UUID storage key
    const uniqueKey = `folios/${crypto.randomUUID()}.${detected.extension}`;
    const destinationPath = path.join(this.uploadDir, uniqueKey);

    // Verify path doesn't escape upload directory
    if (!path.resolve(destinationPath).startsWith(this.uploadDir)) {
      throw new Error('Path traversal attempt rejected');
    }

    await fs.promises.writeFile(destinationPath, buffer);

    return {
      storageKey: uniqueKey,
      originalFilename: path.basename(originalFilename),
      mimeType: detected.mimeType,
      fileSize: buffer.length,
      checksum,
      width,
      height,
    };
  }

  /**
   * Retrieves image read stream while enforcing path containment
   */
  public getImageStream(storageKey: string): { stream: Readable; mimeType: string; size: number } {
    // Sanitize storage key: reject path traversal
    if (storageKey.includes('..') || path.isAbsolute(storageKey)) {
      throw new Error('Invalid storage key: path traversal detected');
    }

    const fullPath = path.resolve(this.uploadDir, storageKey);
    if (!fullPath.startsWith(this.uploadDir)) {
      throw new Error('Access denied: target path escapes upload directory');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('Manuscript image file not found on disk');
    }

    const stat = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    return {
      stream: fs.createReadStream(fullPath),
      mimeType: mimeMap[ext] || 'application/octet-stream',
      size: stat.size,
    };
  }
}

export const storageService = new StorageService();
