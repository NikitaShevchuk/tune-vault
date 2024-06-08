import { Module } from '@nestjs/common';
import { PlayQueueService } from './play.queue.service';

@Module({
  providers: [PlayQueueService],
})
export class PlayQueueModule {}
