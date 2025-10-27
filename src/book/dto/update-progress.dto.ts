import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateProgressDto {
  @IsOptional()
  @IsString()
  currentCFI?: string;

  @IsOptional()
  @IsInt()
  currentLocation?: number;

  @IsOptional()
  @IsInt()
  totalLocations?: number;

  @IsOptional()
  @IsInt()
  currentPage?: number;

  @IsOptional()
  @IsInt()
  totalPages?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage: number;
}
