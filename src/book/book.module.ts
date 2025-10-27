import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { BookProgress } from './entities/book-progress.entity';
import { Book } from './entities/book.entity';
import { Collection } from './entities/collection.entity';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [TypeOrmModule.forFeature([Book, BookProgress, Collection])],
  controllers: [BookController],
  providers: [BookService, SupabaseService],
})
export class BookModule {}
