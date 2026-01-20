import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(isDevelopment && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      }),
    });

    this.bucketName = process.env.UPLOADS_BUCKET!;

    console.log(
      `[S3Service] Initialized with ${isDevelopment ? 'local credentials' : 'IAM role'} for bucket: ${this.bucketName}`,
    );
  }

  /**
   * Generate pre-signed URL for file upload
   * @param userId - User ID
   * @param fileName - Original file name
   * @param fileType - MIME type (application/pdf, image/png, etc.)
   * @param folder - Folder path (e.g., 'licensing/training', 'licensing/exam', 'e-and-o', 'licensing/intake')
   * @returns Pre-signed URL and S3 key
   */
  async getPresignedUploadUrl(
    userId: string,
    fileName: string,
    fileType: string,
    folder: string,
  ): Promise<{ uploadUrl: string; key: string }> {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (!allowedTypes.includes(fileType)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed.',
      );
    }

    // Generate unique file key
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const key = `users/${userId}/${folder}/${uniqueFileName}`;

    // Create PutObject command with 5MB size limit
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
      // Add metadata
      Metadata: {
        originalFileName: fileName,
        uploadedBy: userId,
      },
    });

    // Generate pre-signed URL (valid for 15 minutes)
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Generate pre-signed URL for affiliate profile photo upload
   * @param fileName - Original file name
   * @param fileType - MIME type (image/png, image/jpeg, image/jpg)
   * @returns Pre-signed URL and S3 key
   */
  async getAffiliatePhotoPresignedUrl(
    fileName: string,
    fileType: string,
  ): Promise<{ uploadUrl: string; key: string }> {
    // Validate file type (images only)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(fileType)) {
      throw new BadRequestException(
        'Invalid file type. Only PNG, JPG, and JPEG are allowed for affiliate photos.',
      );
    }

    // Generate unique file key
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const key = `affiliate-profiles/${uniqueFileName}`;

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
      // Add metadata
      Metadata: {
        originalFileName: fileName,
        uploadType: 'affiliate-profile-photo',
      },
    });

    // Generate pre-signed URL (valid for 15 minutes)
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Upload QR code buffer to S3
   * @param qrCodeBuffer - QR code image buffer
   * @param userId - User ID for file naming
   * @returns S3 URL of uploaded QR code
   */
  async uploadQrCode(qrCodeBuffer: Buffer, userId: string): Promise<string> {
    const key = `users/${userId}/qr-codes/${userId}.png`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: qrCodeBuffer,
      ContentType: 'image/png',
      Metadata: {
        userId,
        type: 'qr-code',
      },
    });

    await this.s3Client.send(command);

    return this.getPublicUrl(key);
  }

  /**
   * Get public URL for uploaded file
   * @param key - S3 key
   * @returns Public URL
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  /**
   * Generate pre-signed URL for file download
   * @param key - S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 15 minutes)
   * @returns Pre-signed download URL
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 900,
  ): Promise<string> {
    if (!key) {
      throw new BadRequestException('S3 key is required');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    return downloadUrl;
  }
}
