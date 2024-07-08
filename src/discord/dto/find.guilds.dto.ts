import { IsString } from 'class-validator';

export class FindGuildsDto {
  @IsString()
  ids: string;
}
