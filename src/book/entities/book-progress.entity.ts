import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Book } from './book.entity';
import { User } from 'src/user/entities/user.entity';

@Entity('book_progress')
export class BookProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  currentPage: number;

  @Column({ nullable: true })
  totalPages: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progressPercentage: number;

  @Column({ nullable: true })
  lastReadChapter: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  timeSpentReading: number; // in minutes

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  lastReadAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Book, (book) => book.bookProgress, { eager: false })
  book: Book;

  @Column()
  bookId: number;

  @ManyToOne(() => User, (user) => user.bookProgress, { eager: false })
  user: User;

  @Column()
  userId: number;
}
