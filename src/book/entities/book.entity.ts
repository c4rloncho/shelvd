import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { BookProgress } from './book-progress.entity';

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
  coverUrl: string;

  @Column({ nullable: true })
  coverPublicId: string;

  @Column({ nullable: true })
  pageCount: number;

  @Column({ default: 'unread' })
  readingStatus: string; // 'unread', 'reading', 'completed'

  @Column({ nullable: true })
  rating: number;

  @CreateDateColumn()
  addedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.books, { eager: false })
  owner: User;

  @Column()
  ownerId: number;

  @OneToMany(() => BookProgress, (progress) => progress.book)
  bookProgress: BookProgress[];
}
