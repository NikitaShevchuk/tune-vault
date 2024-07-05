import { Transform } from 'class-transformer';
import { IsArray } from 'class-validator';

export class FindGuildsDto {
  @Transform(({ value }) => value.split(','))
  @IsArray()
  ids: string[];
}
