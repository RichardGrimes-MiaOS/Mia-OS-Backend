import * as QRCode from 'qrcode';
import { S3Service } from '../../onboarding/services/s3.service';

/**
 * Generate QR code and upload to S3
 * @param url - URL to encode in QR code (referral link)
 * @param userId - User ID for file naming
 * @param s3Service - S3 service instance for uploading
 * @returns S3 URL of uploaded QR code
 */
export async function generateAndUploadQrCode(
  url: string,
  userId: string,
  s3Service: S3Service,
): Promise<string> {
  // Generate QR code as buffer
  const qrCodeBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 512,
    margin: 1,
  });

  // Upload to S3 using S3Service
  return await s3Service.uploadQrCode(qrCodeBuffer, userId);
}
