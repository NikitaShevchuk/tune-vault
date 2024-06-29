import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  id: string;

  @IsString()
  username: string;

  @IsString()
  globalName: string;

  @IsBoolean()
  bot: boolean;

  @IsDateString()
  createdAt: Date;

  @IsOptional()
  @IsString()
  avatar?: string;
}
