import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from 'src/user/user.module';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { BookProgress } from './entities/book-progress.entity';
import { Book } from './entities/book.entity';
import { Collection } from './entities/collection.entity';
import { R2Service } from './r2.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Book, BookProgress, Collection]),
    UserModule,
  ],
  controllers: [BookController],
  providers: [BookService, R2Service],
})
export class BookModule {}
