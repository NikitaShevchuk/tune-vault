import { IsString } from 'class-validator';

export class AuthDto {
  @IsString()
  token: string;
}
