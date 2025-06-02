import fs from 'fs-extra';
import path from 'path';
import { getSignedUrl as createSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { log } from '@listen-fair-play/logging';

// Configuration constants
const DEV_BUCKET_NAME = 'listen-fair-play-s3-dev';
const PROD_BUCKET_NAME = 'listen-fair-play-s3-prod';

// CURSOR-TODO: Can we set this relative to where this file currently is, rather than the running process?
// Currently, this breaks if the package importing this file moves
const LOCAL_S3_PATH = path.join(process.cwd(), '../../../aws-local-dev/s3');

// IMPORTANT!!! CURSOR-TODO: This needs to be set at build time (rolldown) when building for Lambda deployment
const FILE_STORAGE_ENV = process.env.FILE_STORAGE_ENV || 'dev-s3';


const AWS_PROFILE = process.env.AWS_PROFILE;

// Initialize S3 client for AWS environments
const s3 = new S3({
  region: process.env.AWS_REGION || 'us-east-1',
  // Conditionally set credentials only for local development
  credentials: FILE_STORAGE_ENV === 'local' ? fromSSO({ profile: AWS_PROFILE }) : undefined,
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
      // TODO: Remove this logging after debugging
      log.info(`Error checking if fileExists for ${key}, bucketName: ${bucketName}, error: ${error}`);

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
      log.error('Error checking if directory exists:', error);
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
    
    // Create an empty object with the directory name using Upload
    const parallelUpload = new Upload({
      client: s3,
      params: {
        Bucket: bucketName,
        Key: dirPrefix,
        Body: '',
      },
    });

    await parallelUpload.done();
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
    try {
      if (await fs.pathExists(localPath)) {
        // Get all files in the directory
        const files = await fs.promises.readdir(localPath);
        return files
          .filter(file => file !== '.DS_Store') // Filter out .DS_Store
          .map(file => path.join(prefix, file));
      }
      return [];
    } catch (error) {
      log.error('Error listing local files:', error);
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
        .filter(key => key !== '' && !key.endsWith('.DS_Store'));
    } catch (error) {
      log.error('Error listing S3 files:', error);
      return [];
    }
  }
}

/**
 * Get total size of all files in a directory
 */
export async function getDirectorySize(prefix: string): Promise<number> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(prefix);
    try {
      if (await fs.pathExists(localPath)) {
        const files = await fs.promises.readdir(localPath);
        let totalSize = 0;
        
        for (const file of files) {
          if (file === '.DS_Store') continue; // Skip .DS_Store
          const filePath = path.join(localPath, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        }
        
        return totalSize;
      }
      return 0;
    } catch (error) {
      log.error('Error getting directory size:', error);
      return 0;
    }
  } else {
    const bucketName = getBucketName();
    try {
      const response = await s3.listObjectsV2({
        Bucket: bucketName,
        Prefix: prefix,
      });
      
      return (response.Contents || [])
        .filter(item => !item.Key?.endsWith('.DS_Store'))
        .reduce((total, item) => total + (item.Size || 0), 0);
    } catch (error) {
      log.error('Error getting directory size:', error);
      return 0;
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

    const parallelUpload = new Upload({
      client: s3,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: content,
      },
      partSize: 20 * 1024 * 1024, // 20MB parts
      queueSize: 4, // 4 concurrent uploads
    });

    parallelUpload.on('httpUploadProgress', (progress) => {
      if (progress.total && progress.loaded && progress.part) {
        const percentage = (progress.loaded / progress.total) * 100;
        log.info(`Upload progress: ${percentage.toFixed(2)}%, for part ${progress.part}`);
      }
    });

    await parallelUpload.done();
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

/**
 * List directories (unique prefixes) with a specific prefix
 * This is useful when you need to find subdirectories under a given path
 */
export async function listDirectories(prefix: string): Promise<string[]> {
  if (FILE_STORAGE_ENV === 'local') {
    const localPath = getLocalFilePath(prefix);
    try {
      if (await fs.pathExists(localPath)) {
        // Get all directories in the path
        const items = await fs.promises.readdir(localPath, { withFileTypes: true });
        return items
          .filter(item => item.isDirectory() && item.name !== '.DS_Store')
          .map(item => path.join(prefix, item.name));
      }
      return [];
    } catch (error) {
      log.error('Error listing local directories:', error);
      return [];
    }
  } else {
    // For S3, we need to extract unique directory prefixes from the file list
    const bucketName = getBucketName();
    try {
      const response = await s3.listObjectsV2({
        Bucket: bucketName,
        Prefix: prefix,
        Delimiter: '/', // This helps S3 group by "directories"
      });
      
      // Get directory prefixes from CommonPrefixes
      const directories = (response.CommonPrefixes || [])
        .map(item => item.Prefix || '')
        .filter(prefix => prefix !== '');
      
      return directories;
    } catch (error) {
      log.error('Error listing S3 directories:', error);
      return [];
    }
  }
} 