import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrationsTableName: 'migrations',
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: ['error', 'warn'],
  logger: 'advanced-console',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export default databaseConfig;
