import fs from 'fs-extra';
import path from 'path';
import { ServiceException } from '@smithy/smithy-client';
import { getSignedUrl as createSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3';

// Configuration constants
const FILE_STORAGE_ENV = process.env.FILE_STORAGE_ENV || 'local';
const LOCAL_S3_PATH = path.join(process.cwd(), '../aws-local-dev/s3');
const DEV_BUCKET_NAME = 'listen-fair-play-s3-bucket-dev';
const PROD_BUCKET_NAME = 'listen-fair-play-s3-bucket-prod';

// Initialize S3 client for AWS environments
const s3 = new S3({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Get the bucket name based on environment
 */
function getBucketName(): string {
  switch (FILE_STORAGE_ENV) {
    case 'dev-s3':
      return DEV_BUCKET_NAME;
    case 'prod-s3':
      return PROD_BUCKET_NAME;
    default:
      return '';
  }
}

/**
 * Resolve a local file path from an S3 key
 */
function getLocalFilePath(key: string): string {
  return path.join(LOCAL_S3_PATH, key);
}

/**
 * Check if a file exists at the specified path/key
 */
export async function fileExists(key: string): Promise<boolean> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(key);
    return fs.pathExists(localPath);
  } else {
    const bucketName = getBucketName();
    try {
      await s3.headObject({
        Bucket: bucketName,
        Key: key,
      });
      return true;
    } catch (error) {
      // Check if the error is a "NotFound" error
      if (error instanceof Error && (error as any).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

/**
 * Check if a directory exists at the specified prefix
 * In S3, there are no actual directories, but we can check if there are objects with the prefix
 */
export async function directoryExists(prefix: string): Promise<boolean> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(prefix);
    return fs.pathExists(localPath);
  } else {
    // Make sure the prefix ends with a slash
    const dirPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const bucketName = getBucketName();
    
    try {
      const response = await s3.listObjectsV2({
        Bucket: bucketName,
        Prefix: dirPrefix,
        MaxKeys: 1,
      });
      
      return (response.Contents || []).length > 0;
    } catch (error) {
      console.error('Error checking if directory exists:', error);
      return false;
    }
  }
}

/**
 * Create a directory at the specified prefix
 * In S3, we create an empty object with the directory prefix to simulate a directory
 */
export async function createDirectory(prefix: string): Promise<void> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(prefix);
    await fs.ensureDir(localPath);
  } else {
    // Make sure the prefix ends with a slash
    const dirPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const bucketName = getBucketName();
    
    // Create an empty object with the directory name
    await s3.putObject({
      Bucket: bucketName,
      Key: dirPrefix,
      Body: '',
    });
  }
}

/**
 * Get a file from S3 or local storage
 */
export async function getFile(key: string): Promise<Buffer> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(key);
    return fs.readFile(localPath);
  } else {
    const bucketName = getBucketName();
    const response = await s3.getObject({
      Bucket: bucketName,
      Key: key,
    });
    
    // Convert the response stream to a buffer
    if (!response.Body) {
      throw new Error('Empty response body');
    }
    
    // Handle response.Body as a stream
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }
}

/**
 * List files with a specific prefix
 */
export async function listFiles(prefix: string): Promise<string[]> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(prefix);
    const baseDir = path.dirname(localPath);
    
    try {
      if (await fs.pathExists(baseDir)) {
        const files = await fs.readdir(baseDir, { recursive: true });
        return files
          .filter(file => {
            // Convert any Buffer to string
            const fileName = file.toString();
            return fileName.startsWith(path.basename(prefix));
          })
          .map(file => path.join(path.dirname(prefix), file.toString()));
      }
      return [];
    } catch (error) {
      console.error('Error listing local files:', error);
      return [];
    }
  } else {
    const bucketName = getBucketName();
    try {
      const response = await s3.listObjectsV2({
        Bucket: bucketName,
        Prefix: prefix,
      });
      
      return (response.Contents || [])
        .map(item => item.Key || '')
        .filter(key => key !== '');
    } catch (error) {
      console.error('Error listing S3 files:', error);
      return [];
    }
  }
}

/**
 * Save a file to S3 or local storage
 */
export async function saveFile(key: string, content: Buffer | string): Promise<void> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(key);
    // Ensure the directory exists
    await fs.ensureDir(path.dirname(localPath));
    // Write the file
    await fs.writeFile(localPath, content);
  } else {
    const bucketName = getBucketName();
    await s3.putObject({
      Bucket: bucketName,
      Key: key,
      Body: content,
    });
  }
}

/**
 * Delete a file from S3 or local storage
 */
export async function deleteFile(key: string): Promise<void> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(key);
    if (await fs.pathExists(localPath)) {
      await fs.unlink(localPath);
    }
  } else {
    const bucketName = getBucketName();
    await s3.deleteObject({
      Bucket: bucketName,
      Key: key,
    });
  }
}

/**
 * Get a signed URL for a file (for temporary access)
 * Note: Only works in S3 environments, returns local file URL in local mode
 */
export async function getSignedUrl(key: string, expirationSeconds = 3600): Promise<string> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(key);
    return `file://${localPath}`;
  } else {
    const bucketName = getBucketName();
    return createSignedUrl(s3, new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }), {
      expiresIn: expirationSeconds,
    });
  }
} 