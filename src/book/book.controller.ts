import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { BookService } from './book.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

// book.controller.ts
@Controller('books')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 30 * 1024 * 1024 }), // 30MB máximo por archivo
          new FileTypeValidator({
            fileType:
              /(application\/epub\+zip|application\/pdf|application\/x-mobipocket-ebook)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req,
  ) {
    const bookData = await this.bookService.create(file, req.user.id);

    return {
      message: 'Libro subido exitosamente',
      data: bookData,
    };
  }

  @Patch(':id/progress')
  @UseGuards(AuthGuard('jwt'))
  async updateProgress(
    @Param('id') id: string,
    @Body('currentPage') currentPage: number,
    @Body('totalPages') totalPages: number,
    @Body('currentCFI') currentCFI: string,
    @Req() req,
  ) {
    const bookId = parseInt(id, 10);
    return await this.bookService.updateProgress(
      bookId,
      currentPage,
      totalPages,
      currentCFI,
      req.user.id,
    );
  }

  // ==================== ENDPOINTS DE COLECCIONES ====================

  @Post('create-collection')
  @UseGuards(AuthGuard('jwt'))
  async createCollection(
    @Body() createCollectionDto: CreateCollectionDto,
    @Req() req,
  ) {
    const userId = req.user.id;
    return await this.bookService.createCollection(createCollectionDto, userId);
  }
  @Get('collections')
  @UseGuards(AuthGuard('jwt'))
  async getCollections(@Req() req) {
    return await this.bookService.getCollections(req.user.id);
  }

  @Get('collections/:id/books')
  @UseGuards(AuthGuard('jwt'))
  async getCollection(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req,
  ) {
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;

    return await this.bookService.getCollection(
      id,
      req.user.id,
      pageNumber,
      limitNumber,
    );
  }

  @Patch('collections/:id')
  @UseGuards(AuthGuard('jwt'))
  async updateCollection(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCollectionDto: UpdateCollectionDto,
    @Req() req,
  ) {
    return await this.bookService.updateCollection(
      id,
      updateCollectionDto,
      req.user.id,
    );
  }

  @Delete('collections/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteCollection(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return await this.bookService.deleteCollection(id, req.user.id);
  }

  @Post('collections/:id/books/:bookId')
  @UseGuards(AuthGuard('jwt'))
  async addBookToCollection(
    @Param('id', ParseIntPipe) collectionId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Req() req,
  ) {
    const userId = req.user.id;
    return await this.bookService.addBookToCollection(
      collectionId,
      bookId,
      userId,
    );
  }

  @Delete('collections/:id/books/:bookId')
  @UseGuards(AuthGuard('jwt'))
  async removeBookFromCollection(
    @Param('id', ParseIntPipe) collectionId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Req() req,
  ) {
    return await this.bookService.removeBookFromCollection(
      collectionId,
      bookId,
      req.user.id,
    );
  }

  // ==================== ENDPOINTS DE LIBROS ====================

  @Get(':id/progress')
  @UseGuards(AuthGuard('jwt'))
  async getProgress(@Param('id') id: string, @Req() req) {
    const bookId = parseInt(id, 10);
    const book = await this.bookService.findOne(bookId, req.user.id);

    if (!book || !book.bookProgress) {
      throw new NotFoundException('No hay progreso guardado');
    }

    return {
      currentPage: book.bookProgress.currentLocation,
      totalPages: book.bookProgress.totalLocations,
      currentCFI: book.bookProgress.currentCFI,
      progressPercentage:
        Math.round(book.bookProgress.progressPercentage * 100) / 100,
      completed: book.bookProgress.isCompleted,
    };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getAllBooks(
    @Req() req,
    @Query('title') title?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return await this.bookService.findAll(req.user.id, title, page, limit);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getBook(@Param('id') id: number, @Req() req) {
    return await this.bookService.findOne(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteBook(@Param('id') id: number, @Req() req) {
    return await this.bookService.delete(id, req.user.id);
  }
}
