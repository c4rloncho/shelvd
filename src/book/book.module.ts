import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from 'src/user/user.module';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { BookProgress } from './entities/book-progress.entity';
import { Book } from './entities/book.entity';
import { Collection } from './entities/collection.entity';
import { LocalStorageService } from './local-storage.service';
import { R2Service } from './r2.service';
import { IStorageService } from './storage.interface';

const STORAGE_SERVICE = 'STORAGE_SERVICE';

@Module({
  imports: [
    TypeOrmModule.forFeature([Book, BookProgress, Collection]),
    UserModule,
  ],
  controllers: [BookController],
  providers: [
    BookService,
    R2Service,
    LocalStorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: (configService: ConfigService): IStorageService => {
        const isDevelopment = configService.get('NODE_ENV') === 'development';
        return isDevelopment
          ? new LocalStorageService(configService)
          : new R2Service(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class BookModule {}
