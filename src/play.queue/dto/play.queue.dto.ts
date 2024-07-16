import { IsArray, IsBoolean, IsString, IsUrl, ValidateNested } from 'class-validator';
import { PlayQueueType } from '../types';
import { Type } from 'class-transformer';

class PlayQueueItemDto {
  @IsBoolean()
  alreadyPlayed: boolean;

  @IsString()
  @IsUrl()
  url: string;
}

export class PlayQueueDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayQueueItemDto)
  queue: PlayQueueType;
}
