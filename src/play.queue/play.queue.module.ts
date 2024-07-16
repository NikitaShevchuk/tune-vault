import { Module } from '@nestjs/common';
import { PlayQueueService } from './play.queue.service';
import { DbModule } from 'src/db/db.module';

@Module({
  providers: [PlayQueueService],
  imports: [DbModule],
})
export class PlayQueueModule {}
