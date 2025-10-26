import { BookProgress } from 'src/book/entities/book-progress.entity';
import { Book } from 'src/book/entities/book.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullname: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Book, (book) => book.owner, { eager: true })
  books: Book[];

  @OneToMany(() => BookProgress, (bookProgress) => bookProgress.user)
  bookProgress: BookProgress[];

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ nullable: true })
  avatarPublicId?: string;
}
