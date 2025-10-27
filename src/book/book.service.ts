// book.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { User } from 'src/user/entities/user.entity';
import { In, Repository } from 'typeorm';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { BookProgress } from './entities/book-progress.entity';
import { Book, ReadingStatus } from './entities/book.entity';
import { Collection } from './entities/collection.entity';
import { SupabaseService } from './supabase.service';

const EPub = require('epub');
const pdfParse = require('pdf-parse');

@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
    private supabaseService: SupabaseService,
    @InjectRepository(BookProgress)
    private bookProgressRepository: Repository<BookProgress>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
  ) {}

  // ==================== FUNCIONES AUXILIARES ====================

  /**
   * Agrega URLs firmadas a un libro individual
   */
  private async addSignedUrlsToBook(book: Book) {
    const bookUrl = await this.supabaseService.getSignedUrl(
      book.filePath,
      10800, // 3 horas
    );

    let coverUrl: { signedUrl: string; expiresAt: Date } | null = null;
    if (book.coverPath) {
      coverUrl = await this.supabaseService.getSignedUrl(
        book.coverPath,
        7200, // 2 horas
      );
    }

    return {
      ...book,
      bookUrl: bookUrl.signedUrl,
      coverUrl: coverUrl ? coverUrl.signedUrl : null,
      bookUrlExpiresAt: bookUrl.expiresAt,
      coverUrlExpiresAt: coverUrl?.expiresAt,
    };
  }

  /**
   * Agrega URLs firmadas a múltiples libros
   */
  private async addSignedUrlsToBooks(books: Book[]) {
    return await Promise.all(
      books.map((book) => this.addSignedUrlsToBook(book)),
    );
  }

  // ==================== CRUD DE LIBROS ====================

  async create(file: Express.Multer.File, userId: number) {
    // 1. Subir archivo a Supabase
    const uploadResult = await this.supabaseService.uploadFile(file, 'books');

    // 2. Extraer metadata según el tipo de archivo
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    let metadata;
    let coverPath = '';
    let fileType: 'epub' | 'pdf';

    if (fileExtension === 'epub') {
      fileType = 'epub';
      const epubData = await this.extractEpubMetadata(file.buffer);
      metadata = epubData.metadata;

      // 3. Subir portada si existe
      if (epubData.coverBuffer) {
        const coverFile = {
          buffer: epubData.coverBuffer,
          originalname: `cover-${Date.now()}.jpg`,
          mimetype: 'image/jpeg',
        } as Express.Multer.File;

        const coverUpload = await this.supabaseService.uploadFile(
          coverFile,
          'covers',
        );

        coverPath = coverUpload.path;
      }
    } else if (fileExtension === 'pdf') {
      fileType = 'pdf';
      metadata = await this.extractPdfMetadata(file.buffer);
    } else {
      throw new Error('Formato no soportado');
    }

    // 4. Crear y guardar libro en base de datos
    const book = this.bookRepository.create({
      title: metadata.title || file.originalname,
      description: metadata.description || '',
      author: metadata.author || 'Desconocido',
      isbn: metadata.isbn || null,
      publisher: metadata.publisher || null,
      publishedDate: metadata.publishedDate || null,
      pageCount: fileType === 'pdf' ? metadata.pageCount : null, // Solo para PDF
      readingStatus: ReadingStatus.UNREAD,
      filePath: uploadResult.path,
      coverPath: coverPath,
      fileType: fileType, // Agregar campo en la entidad Book
      owner: { id: userId } as User,
    });

    const savedBook = await this.bookRepository.save(book);

    // 5. Crear book-progress según el tipo de archivo
    const bookProgress = new BookProgress();
    bookProgress.book = savedBook;
    bookProgress.progressPercentage = 0;
    bookProgress.isCompleted = false;

    if (fileType === 'pdf') {
      // Para PDFs: usar sistema de páginas
      bookProgress.currentPage = 0;
      bookProgress.totalPages = metadata.pageCount || null;
    } else {
      // Para EPUBs: usar sistema de locations (se calculará en el frontend)
      bookProgress.currentCFI = null;
      bookProgress.currentLocation = null;
      bookProgress.totalLocations = null;
      bookProgress.book = savedBook;
    }

    await this.bookProgressRepository.save(bookProgress);

    return savedBook;
  }

  async findOne(id: number, userId: number) {
    const book = await this.bookRepository.findOne({
      where: { id: id, owner: { id: userId } },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return await this.addSignedUrlsToBook(book);
  }

  async findAll(userId: number, title?: string, page = 1, limit = 10) {
    const query = this.bookRepository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.bookProgress', 'bookProgress')
      .leftJoinAndSelect('book.owner', 'owner')
      .where('owner.id = :userId', { userId });

    if (title) {
      query.andWhere('book.title ILIKE :title', { title: `%${title}%` });
    }

    query.orderBy('book.title', 'ASC');
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [books, total] = await query.getManyAndCount();
    const booksWithUrls = await this.addSignedUrlsToBooks(books);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: booksWithUrls,
    };
  }

  async delete(id: number, userId: number) {
    const book = await this.bookRepository.findOne({
      where: { id, owner: { id: userId } },
    });

    if (!book) {
      throw new NotFoundException('Libro no encontrado o no tienes permisos');
    }

    // Eliminar archivo del libro de Supabase Storage
    await this.supabaseService.deleteFile(book.filePath);

    // Eliminar portada si existe
    if (book.coverPath) {
      await this.supabaseService.deleteFile(book.coverPath);
    }

    await this.bookRepository.remove(book);

    return { message: 'Libro eliminado exitosamente' };
  }

  // ==================== PROGRESO DE LECTURA ====================

  async updateProgress(
    bookId: number,
    currentPage: number,
    totalPages: number,
    currentCFI: string,
    userId: number,
  ) {
    const book = await this.bookRepository.findOne({
      where: { id: bookId, owner: { id: userId } },
      relations: ['bookProgress'],
    });

    if (!book) {
      throw new NotFoundException('Libro no encontrado o no tienes permisos');
    }

    if (currentPage < 0 || currentPage > totalPages) {
      throw new BadRequestException('Número de página inválido');
    }

    if (book.readingStatus === ReadingStatus.UNREAD) {
      book.readingStatus = ReadingStatus.READING;
    }

    if (!book.bookProgress) {
      const newProgress = new BookProgress();
      newProgress.book = book;

      newProgress.currentCFI = currentCFI;
      newProgress.currentLocation = currentPage;
      newProgress.totalLocations = totalPages;

      // Campos de PDF = null
      newProgress.currentPage = null;
      newProgress.totalPages = null;

      newProgress.progressPercentage =
        totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
      newProgress.isCompleted = currentPage >= totalPages;

      book.bookProgress = await this.bookProgressRepository.save(newProgress);
    } else {
      book.bookProgress.currentCFI = currentCFI;
      book.bookProgress.currentLocation = currentPage;
      book.bookProgress.totalLocations = totalPages;
      book.bookProgress.progressPercentage =
        totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
      book.bookProgress.isCompleted = currentPage >= totalPages;

      await this.bookProgressRepository.save(book.bookProgress);
    }

    await this.bookRepository.save(book);

    return {
      message: 'Progreso actualizado exitosamente',
      progress: {
        currentPage: book.bookProgress.currentLocation,
        totalPages: book.bookProgress.totalLocations,
        currentCFI: book.bookProgress.currentCFI,
        progressPercentage:
          Math.round(book.bookProgress.progressPercentage * 100) / 100,
        completed: book.bookProgress.isCompleted,
      },
    };
  }

  // ==================== COLECCIONES ====================

  async createCollection(
    createCollectionDto: CreateCollectionDto,
    userId: number,
  ) {
    const collection = new Collection();
    collection.name = createCollectionDto.name;
    collection.description = createCollectionDto.description || '';
    collection.owner = { id: userId } as User;

    // Verificar que libros existan
    if (createCollectionDto.bookIds && createCollectionDto.bookIds.length > 0) {
      const books = await this.bookRepository.find({
        where: {
          id: In(createCollectionDto.bookIds),
        },
      });

      // Validar que todos los libros existan
      if (books.length !== createCollectionDto.bookIds.length) {
        throw new NotFoundException('One or more books not found');
      }

      collection.books = books;
    } else {
      collection.books = [];
    }

    return await this.collectionRepository.save(collection);
  }

  async getCollections(userId: number) {
    return await this.collectionRepository.find({
      where: { owner: { id: userId } },
      relations: ['books'],
    });
  }

  async getCollection(
    id: number,
    userId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id: id },
      relations: ['owner'],
    });

    if (!collection) {
      throw new NotFoundException(
        'Collection not found or you do not have permission',
      );
    }

    const skip = (page - 1) * limit;

    const [books, total] = await this.bookRepository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.bookProgress', 'bookProgress')
      .innerJoin('book.collections', 'collection')
      .where('collection.id = :collectionId', { collectionId: id })
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const booksWithUrls = await this.addSignedUrlsToBooks(books);

    return {
      data: {
        ...collection,
        books: booksWithUrls,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateCollection(
    id: number,
    updateData: { name?: string; description?: string },
    userId: number,
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id: id, owner: { id: userId } },
    });

    if (!collection) {
      throw new NotFoundException(
        'Collection not found or you do not have permission',
      );
    }

    if (updateData.name) {
      collection.name = updateData.name;
    }

    if (updateData.description !== undefined) {
      collection.description = updateData.description;
    }

    await this.collectionRepository.save(collection);

    return {
      message: 'Collection updated successfully',
      collection,
    };
  }

  async deleteCollection(id: number, userId: number) {
    const collection = await this.collectionRepository.findOne({
      where: { id: id, owner: { id: userId } },
    });

    if (!collection) {
      throw new NotFoundException(
        'Collection not found or you do not have permission',
      );
    }

    await this.collectionRepository.remove(collection);

    return {
      message: 'Collection deleted successfully',
    };
  }

  async addBookToCollection(
    collectionId: number,
    bookId: number,
    userId: number,
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId, owner: { id: userId } },
      relations: ['books'],
    });

    if (!collection) {
      throw new NotFoundException(
        'collection not found or you do not have permission',
      );
    }

    const book = await this.bookRepository.findOne({
      where: { id: bookId, owner: { id: userId } },
    });

    if (!book) {
      throw new NotFoundException(
        'Book not found or you do not have permission',
      );
    }

    // Verificar si el libro ya está en la colección
    const bookExists = collection.books.some((b) => b.id === bookId);
    if (bookExists) {
      throw new BadRequestException('Book is already in this collection');
    }

    collection.books.push(book);
    await this.collectionRepository.save(collection);

    return {
      message: 'Book added to collection successfully',
      collection,
    };
  }

  async removeBookFromCollection(
    collectionId: number,
    bookId: number,
    userId: number,
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId, owner: { id: userId } },
      relations: ['books'],
    });

    if (!collection) {
      throw new NotFoundException(
        'Collection not found or you do not have permission',
      );
    }

    const bookIndex = collection.books.findIndex((book) => book.id === bookId);

    if (bookIndex === -1) {
      throw new NotFoundException('Book not found in this collection');
    }

    collection.books.splice(bookIndex, 1);
    await this.collectionRepository.save(collection);

    return {
      message: 'Book removed from collection successfully',
      collection,
    };
  }

  // ==================== EXTRACCIÓN DE METADATA ====================

  private async extractEpubMetadata(buffer: Buffer) {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `temp-${Date.now()}.epub`);

    try {
      fs.writeFileSync(tempFilePath, buffer);

      return new Promise<{ metadata: any; coverBuffer: Buffer | null }>(
        (resolve, reject) => {
          const epub = new EPub(tempFilePath);

          epub.on('end', () => {
            const metadata = epub.metadata;

            const metadataResult = {
              title: metadata.title || '',
              author: metadata.creator || '',
              description: metadata.description?.replace(/<[^>]*>/g, '') || '',
              publisher: metadata.publisher || null,
              publishedDate: metadata.date ? new Date(metadata.date) : null,
              isbn: metadata.ISBN || null,
              pageCount: null,
            };

            // Función para buscar la portada en el manifest
            const findCover = () => {
              // Lista de posibles IDs y nombres de portada
              const coverPatterns = [
                epub.metadata.cover,
                'cover',
                'cover-image',
                'cover.jpg',
                'cover.jpeg',
                'cover.png',
              ];

              // Buscar en el manifest
              for (const pattern of coverPatterns) {
                if (!pattern) continue;

                // Buscar por ID exacto
                if (epub.manifest[pattern]) {
                  return pattern;
                }

                // Buscar por nombre similar
                for (const [id, item] of Object.entries(epub.manifest)) {
                  const itemData = item as any;
                  if (
                    itemData.href &&
                    (itemData.href.toLowerCase().includes('cover') ||
                      itemData['media-type']?.startsWith('image/'))
                  ) {
                    return id;
                  }
                }
              }

              return null;
            };

            const coverId = findCover();

            if (coverId) {
              epub.getImage(coverId, (error, img, mimeType) => {
                if (fs.existsSync(tempFilePath)) {
                  fs.unlinkSync(tempFilePath);
                }

                if (error || !img) {
                  console.log('No se pudo extraer la portada:', error?.message);
                  resolve({
                    metadata: metadataResult,
                    coverBuffer: null,
                  });
                } else {
                  console.log('✓ Portada extraída exitosamente');
                  resolve({
                    metadata: metadataResult,
                    coverBuffer: img,
                  });
                }
              });
            } else {
              console.log('No se encontró portada en el manifest del EPUB');
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
              resolve({
                metadata: metadataResult,
                coverBuffer: null,
              });
            }
          });

          epub.on('error', (error) => {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
            reject(error);
          });

          epub.parse();
        },
      );
    } catch (error) {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw new Error(`Error extrayendo metadata del EPUB: ${error.message}`);
    }
  }

  private async extractPdfMetadata(buffer: Buffer) {
    const data = await pdfParse(buffer);

    return {
      title: data.info?.Title || '',
      author: data.info?.Author || '',
      description: data.info?.Subject || '',
      publisher: data.info?.Producer || null,
      publishedDate: data.info?.CreationDate
        ? new Date(data.info.CreationDate)
        : null,
      isbn: null,
      pageCount: data.numpages || null,
    };
  }
}
