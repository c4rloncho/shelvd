import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookProgress } from './book-progress.entity';
import { Collection } from './collection.entity';

export enum ReadingStatus {
  UNREAD = 'unread',
  READING = 'reading',
  COMPLETED = 'completed',
}
@Entity('books')
export class Book {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  author: string;

  @Column({ nullable: true })
  isbn: string;

  @Column({ nullable: true })
  publisher: string;

  @Column({ nullable: true, type: 'date' })
  publishedDate: Date;

  @Column({ nullable: true })
  coverPath: string;

  @Column({ nullable: true })
  coverPublicId: string;

  @Column({ nullable: true })
  pageCount: number;

  @Column()
  filePath: string;

  @Column({
    type: 'enum',
    enum: ReadingStatus,
    default: ReadingStatus.UNREAD,
  })
  readingStatus: ReadingStatus;

  @Column({ nullable: true })
  rating: number;

  @CreateDateColumn()
  addedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 10 })
  fileType: 'epub' | 'pdf';

  @Column({ default: false })
  isFavorite: boolean;

  @ManyToOne(() => User, (user) => user.books, { eager: false })
  owner: User;

  @OneToOne(() => BookProgress, (progress) => progress.book)
  bookProgress: BookProgress;

  @ManyToMany(() => Collection, (collection) => collection.books)
  @JoinTable()
  collections: Collection[];
}
