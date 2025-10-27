// supabase.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private defaultBucket: string;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL') ?? '',
      this.configService.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    this.defaultBucket =
      this.configService.get('SUPABASE_STORAGE_BUCKET') ?? 'uploads';
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
    bucket?: string,
  ) {
    const bucketName = bucket ?? this.defaultBucket;

    // Sanitizar nombre del archivo
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${Date.now()}-${sanitizedName}`;

    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`Error al subir archivo: ${error.message}`);
    }

    return {
      path: data.path,
      fullPath: data.fullPath,
    };
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600, // 1 hora por defecto
    bucket?: string,
  ) {
    const bucketName = bucket ?? this.defaultBucket;

    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new BadRequestException(
        `Error al generar URL firmada: ${error.message}`,
      );
    }

    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async getCoverSignedUrl(filePath: string) {
    return this.getSignedUrl(filePath, 28800); // 8 horas para covers
  }

  async getBookSignedUrl(filePath: string) {
    return this.getSignedUrl(filePath, 28800); // 8 horas para libros
  }

  async deleteFile(filePath: string, bucket?: string) {
    const bucketName = bucket ?? this.defaultBucket;

    const { error } = await this.supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      throw new BadRequestException(
        `Error al eliminar archivo: ${error.message}`,
      );
    }

    return { success: true };
  }
}
