// r2.service.ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get('R2_BUCKET_NAME') ?? '';

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.get('R2_ENDPOINT') ?? '',
      credentials: {
        accessKeyId: this.configService.get('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.configService.get('R2_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
    bucket?: string,
  ) {
    const bucketName = bucket ?? this.bucketName;

    // Sanitizar nombre del archivo
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${Date.now()}-${sanitizedName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      return {
        path: filePath,
        fullPath: filePath,
      };
    } catch (error) {
      throw new BadRequestException(`Error al subir archivo: ${error.message}`);
    }
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600, // 1 hora por defecto
    bucket?: string,
  ) {
    const bucketName = bucket ?? this.bucketName;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return {
        signedUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al generar URL firmada: ${error.message}`,
      );
    }
  }

  async getCoverSignedUrl(filePath: string) {
    return this.getSignedUrl(filePath, 28800); // 8 horas para covers
  }

  async getBookSignedUrl(filePath: string) {
    return this.getSignedUrl(filePath, 28800); // 8 horas para libros
  }

  async deleteFile(filePath: string, bucket?: string) {
    const bucketName = bucket ?? this.bucketName;

    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);

      return { success: true };
    } catch (error) {
      throw new BadRequestException(
        `Error al eliminar archivo: ${error.message}`,
      );
    }
  }
}
