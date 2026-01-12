import { 
  uploadFile as s3Upload, 
  deleteFile as s3Delete,
  getPresignedUrl as s3GetPresignedUrl,
  generateFileKey as s3GenerateKey,
  UploadResult 
} from '../config/s3.js';
import { firebaseAdmin, isFirebaseInitialized } from '../config/firebase.js';

interface StorageProvider {
  upload(buffer: Buffer, key: string, contentType: string, metadata?: Record<string, string>): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getUrl(key: string, expiresIn?: number): Promise<string>;
  generateKey(folder: string, fileName: string): string;
}

/**
 * S3 Storage Provider
 */
class S3StorageProvider implements StorageProvider {
  async upload(
    buffer: Buffer, 
    key: string, 
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    return s3Upload(buffer, key, contentType);
  }

  async delete(key: string): Promise<void> {
    return s3Delete(key);
  }

  async getUrl(key: string, expiresIn = 3600): Promise<string> {
    return s3GetPresignedUrl(key, expiresIn);
  }

  generateKey(folder: string, fileName: string): string {
    return s3GenerateKey(folder, fileName);
  }
}

/**
 * Firebase Storage Provider
 */
class FirebaseStorageProvider implements StorageProvider {
  private getBucket() {
    if (!isFirebaseInitialized()) {
      throw new Error('firebase-not-initialized');
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    return bucketName
      ? firebaseAdmin.storage().bucket(bucketName)
      : firebaseAdmin.storage().bucket();
  }

  async upload(
    buffer: Buffer, 
    key: string, 
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    const bucket = this.getBucket();
    const file = bucket.file(key);

    await file.save(buffer, {
      contentType,
      metadata,
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500',
    });

    return { url, key };
  }

  async delete(key: string): Promise<void> {
    const bucket = this.getBucket();
    await bucket.file(key).delete();
  }

  async getUrl(key: string, expiresIn = 3600): Promise<string> {
    const bucket = this.getBucket();
    const file = bucket.file(key);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    return url;
  }

  generateKey(folder: string, fileName: string): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${folder}/${timestamp}-${randomId}-${sanitizedName}`;
  }
}

/**
 * Hybrid Storage Service
 * Automatically uses S3 or Firebase based on configuration
 */
export class StorageService {
  private provider: StorageProvider;
  private useFirebase: boolean;

  constructor(useFirebase: boolean = false) {
    this.useFirebase = useFirebase;
    this.provider = useFirebase ? new FirebaseStorageProvider() : new S3StorageProvider();
    
    console.log(`[StorageService] Initialized with ${useFirebase ? 'Firebase' : 'S3'} provider`);
  }

  /**
   * Upload a file
   */
  async uploadFile(
    buffer: Buffer,
    folder: string,
    fileName: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    const key = this.provider.generateKey(folder, fileName);
    return this.provider.upload(buffer, key, contentType, metadata);
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  /**
   * Get download URL (presigned for S3, public/signed for Firebase)
   */
  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.provider.getUrl(key, expiresIn);
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(buffer: Buffer, userId: string, contentType: string): Promise<UploadResult> {
    const fileName = `${userId}.${this.getExtensionFromMimeType(contentType)}`;
    return this.uploadFile(buffer, 'profiles', fileName, contentType);
  }

  /**
   * Upload document
   */
  async uploadDocument(
    buffer: Buffer,
    familyId: string,
    fileName: string,
    contentType: string
  ): Promise<UploadResult> {
    return this.uploadFile(buffer, `documents/${familyId}`, fileName, contentType);
  }

  /**
   * Upload receipt
   */
  async uploadReceipt(
    buffer: Buffer,
    familyId: string,
    expenseId: string,
    fileName: string,
    contentType: string
  ): Promise<UploadResult> {
    return this.uploadFile(buffer, `receipts/${familyId}/${expenseId}`, fileName, contentType);
  }

  /**
   * Upload child photo
   */
  async uploadChildPhoto(
    buffer: Buffer,
    familyId: string,
    childId: string,
    contentType: string
  ): Promise<UploadResult> {
    const fileName = `${childId}.${this.getExtensionFromMimeType(contentType)}`;
    return this.uploadFile(buffer, `children/${familyId}`, fileName, contentType);
  }

  /**
   * Upload family photo
   */
  async uploadFamilyPhoto(
    buffer: Buffer,
    familyId: string,
    contentType: string
  ): Promise<UploadResult> {
    const fileName = `${familyId}.${this.getExtensionFromMimeType(contentType)}`;
    return this.uploadFile(buffer, 'families', fileName, contentType);
  }

  /**
   * Delete profile photo
   */
  async deleteProfilePhoto(userId: string): Promise<void> {
    // Try common extensions
    const extensions = ['jpg', 'jpeg', 'png', 'webp'];
    for (const ext of extensions) {
      try {
        await this.deleteFile(`profiles/${userId}.${ext}`);
      } catch (error) {
        // Ignore errors if file doesn't exist
      }
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    };

    return mimeToExt[mimeType] || 'bin';
  }

  /**
   * Validate file size
   */
  validateFileSize(buffer: Buffer, maxSizeMB: number = 10): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return buffer.length <= maxSizeBytes;
  }

  /**
   * Validate file type
   */
  validateFileType(contentType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(contentType);
  }
}

export function extractStorageKeyFromUrl(url: string): string | null {
  try {
    if (url.startsWith('gs://')) {
      const withoutScheme = url.slice('gs://'.length);
      const slashIndex = withoutScheme.indexOf('/');
      return slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : null;
    }

    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (urlObj.hostname === 'firebasestorage.googleapis.com') {
      const objectIndex = pathParts.indexOf('o');
      if (objectIndex !== -1 && pathParts[objectIndex + 1]) {
        return decodeURIComponent(pathParts[objectIndex + 1]);
      }
      return null;
    }

    if (urlObj.hostname === 'storage.googleapis.com') {
      if (pathParts.length >= 2) {
        return pathParts.slice(1).join('/');
      }
      return null;
    }

    return urlObj.pathname.slice(1);
  } catch {
    return null;
  }
}

// Export singleton instances
export const storageService = new StorageService(false); // S3
export const storageServiceFirebase = new StorageService(true); // Firebase

export default storageService;
