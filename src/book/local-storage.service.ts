import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { IStorageService } from './storage.interface';

@Injectable()
export class LocalStorageService implements IStorageService {
  private uploadsDir: string;
  private backendUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.backendUrl =
      this.configService.get('BACKEND_URL') || 'http://localhost:3000';

    // Crear carpeta uploads/ si no existe
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
    bucket?: string,
  ): Promise<{ path: string; fullPath: string }> {
    // Sanitizar nombre del archivo
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${Date.now()}-${sanitizedName}`;

    try {
      // Crear carpeta si no existe
      const folderPath = path.join(this.uploadsDir, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Guardar archivo
      const localFilePath = path.join(this.uploadsDir, filePath);
      fs.writeFileSync(localFilePath, file.buffer);

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
    expiresIn: number = 3600,
    bucket?: string,
  ): Promise<{ signedUrl: string; expiresAt: Date }> {
    try {
      // Verificar que el archivo existe
      const localFilePath = path.join(this.uploadsDir, filePath);
      if (!fs.existsSync(localFilePath)) {
        throw new BadRequestException('Archivo no encontrado');
      }

      // Devolver URL local
      const localUrl = `${this.backendUrl}/uploads/${filePath}`;

      return {
        signedUrl: localUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al generar URL: ${error.message}`,
      );
    }
  }

  async getCoverSignedUrl(filePath: string): Promise<{
    signedUrl: string;
    expiresAt: Date;
  }> {
    return this.getSignedUrl(filePath, 28800); // 8 horas
  }

  async getBookSignedUrl(filePath: string): Promise<{
    signedUrl: string;
    expiresAt: Date;
  }> {
    return this.getSignedUrl(filePath, 28800); // 8 horas
  }

  async deleteFile(
    filePath: string,
    bucket?: string,
  ): Promise<{ success: boolean }> {
    try {
      const localFilePath = path.join(this.uploadsDir, filePath);

      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }

      return { success: true };
    } catch (error) {
      throw new BadRequestException(
        `Error al eliminar archivo: ${error.message}`,
      );
    }
  }
}
