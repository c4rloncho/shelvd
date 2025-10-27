import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Book } from './book.entity';

@Entity('book_progress')
export class BookProgress {
  @PrimaryGeneratedColumn()
  id: number;

  // Para EPUBs
  @Column({ type: 'text', nullable: true })
  currentCFI: string | null; // Canonical Fragment Identifier

  @Column({ type: 'int', nullable: true })
  currentLocation: number | null; // Ubicación actual

  @Column({ type: 'int', nullable: true })
  totalLocations: number | null; // Total de ubicaciones

  // Para PDFs
  @Column({ type: 'int', nullable: true })
  currentPage: number | null;

  @Column({ type: 'int', nullable: true })
  totalPages: number | null;

  // Universal
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progressPercentage: number; // 0-100

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastReadAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  lastReadChapter: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', nullable: true })
  timeSpentReading: number | null; // in minutes

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Book, (book) => book.bookProgress, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  book: Book;

  @ManyToOne(() => User, (user) => user.bookProgress, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  user: User;
}
