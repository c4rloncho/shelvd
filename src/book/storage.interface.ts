export interface IStorageService {
  uploadFile(
    file: Express.Multer.File,
    folder: string,
    bucket?: string,
  ): Promise<{ path: string; fullPath: string }>;

  getSignedUrl(
    filePath: string,
    expiresIn?: number,
    bucket?: string,
  ): Promise<{ signedUrl: string; expiresAt: Date }>;

  getCoverSignedUrl(filePath: string): Promise<{
    signedUrl: string;
    expiresAt: Date;
  }>;

  getBookSignedUrl(filePath: string): Promise<{
    signedUrl: string;
    expiresAt: Date;
  }>;

  deleteFile(filePath: string, bucket?: string): Promise<{ success: boolean }>;
}
