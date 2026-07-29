import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';
import dayjs from 'dayjs';

export class BaseQueryDTO {
  @ApiPropertyOptional({ description: 'The page number', example: 1 })
  @IsOptional()
  @Transform(({ value }) => {
    if (isNaN(value)) throw new BadRequestException('Invalid page number');
    return parseInt(value);
  })
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ description: 'The number of items per page', example: 50 })
  @IsOptional()
  @Transform(({ value }) => {
    if (isNaN(value)) throw new BadRequestException('Invalid limit number');
    return parseInt(value);
  })
  @Min(1)
  @Max(100)
  readonly limit?: number = 10;
}

export abstract class BaseResponseDTO {
  @Expose()
  id!: string;

  @Expose()
  @Transform(({ value }) => dayjs(value).toISOString())
  createdAt!: string;
}

export abstract class BaseResponseWithUpdatedAtDTO extends BaseResponseDTO {
  @Expose()
  @Transform(({ value }) => dayjs(value).toISOString())
  updatedAt!: string;
}

export abstract class BaseResponseWithDeletedAtDTO extends BaseResponseDTO {
  @Expose()
  @Transform(({ value }) => (value ? dayjs(value).toISOString() : undefined))
  deletedAt!: string;
}

export abstract class BaseResponseWithTimestampsDTO extends BaseResponseDTO {
  @Expose()
  @Transform(({ value }) => dayjs(value).toISOString())
  updatedAt!: string;

  @Expose()
  @Transform(({ value }) => (value ? dayjs(value).toISOString() : undefined))
  deletedAt!: string;
}
