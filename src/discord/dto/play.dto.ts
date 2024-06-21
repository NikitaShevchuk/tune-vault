import { IsString, IsUrl } from 'class-validator';

export class PlayDto {
  @IsString()
  @IsUrl()
  url: string;
}
