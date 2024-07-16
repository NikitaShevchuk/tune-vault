import { Injectable, Logger } from '@nestjs/common';

import { DbService } from 'src/db/db.service';
import { PlayQueueType } from './types';
import { PlayQueueDto } from './dto/play.queue.dto';
import { validate } from 'class-validator';

@Injectable()
export class PlayQueueService {
  private readonly logger = new Logger(PlayQueueService.name);

  constructor(private readonly dbService: DbService) {}

  public async getOrCreatePlayQueue(guildId: string): Promise<PlayQueue> {
    const playQueue = await this.dbService.playQueue.findUnique({ where: { guildId } });
    if (playQueue) {
      return playQueue;
    }

    return await this.dbService.playQueue.create({ data: { guildId, queue: [] } });
  }

  public async getCurrentItem(guildId: string): Promise<PlayQueueType[number]> {
    const { queue } = await this.getOrCreatePlayQueue(guildId);

    return queue.filter((item) => item.alreadyPlayed).at(-1);
  }

  public async pushToQueue({ guildId, urls }: { guildId: string; urls: string[] | string }): Promise<void> {
    const queueItems = (Array.isArray(urls) ? urls : [urls]).map<PlayQueueType[number]>((url) => ({
      url,
      alreadyPlayed: false,
    }));
    const { queue: existingQueue } = await this.getOrCreatePlayQueue(guildId);
    const updatedQueue = existingQueue ? [...existingQueue, ...queueItems] : queueItems;

    await this.updateQueue(guildId, updatedQueue);
  }

  public async getNextItem({
    guildId,
    markCurrentAsPlayed = true,
  }: {
    guildId: string;
    markCurrentAsPlayed?: boolean;
  }): Promise<PlayQueueType[number]> {
    const { queue: queue } = await this.getOrCreatePlayQueue(guildId);
    const nextItemIndex = queue.findIndex((item) => !item.alreadyPlayed);

    if (nextItemIndex === -1) {
      return null;
    }

    const updatedQueue = queue.map((item, i) => ({
      ...item,
      alreadyPlayed: markCurrentAsPlayed ? i <= nextItemIndex : i < nextItemIndex,
    }));
    const nextItem = queue[nextItemIndex];
    await this.updateQueue(guildId, updatedQueue);

    return nextItem;
  }

  public async getPrevItem(guildId: string): Promise<PlayQueueType[number]> {
    const { queue } = await this.getOrCreatePlayQueue(guildId);
    if (!queue) {
      return null;
    }

    const reversedQueue = queue.slice().reverse();
    const currentItemIndexInReverseQueue = reversedQueue.findIndex((item) => item.alreadyPlayed);
    const currentItemIndex = queue.length - currentItemIndexInReverseQueue - 1;

    if (currentItemIndex < 1) {
      return null;
    }

    const prevItemIndex = currentItemIndex - 1;
    const updatedQueue = queue.map((item, i) => ({
      ...item,
      alreadyPlayed: i === currentItemIndex ? false : item.alreadyPlayed,
    }));
    const prevItem = queue[prevItemIndex];

    await this.updateQueue(guildId, updatedQueue);

    return prevItem;
  }

  public async destroyQueue(guildId: string): Promise<void> {
    try {
      const queueExists = await this.dbService.playQueue.findUnique({ where: { guildId } });
      if (!queueExists) {
        return;
      }
      await this.dbService.playQueue.delete({ where: { guildId } });
    } catch (e) {
      // TODO add Sentry loggin
      this.logger.error('Failed to destroy the existing queue', e);
    }
  }

  private async updateQueue(guildId: string, updatedQueue: PlayQueueType): Promise<PlayQueue> {
    const queueDto = new PlayQueueDto();
    queueDto.queue = updatedQueue;
    const validationErrors = await validate(queueDto);
    if (validationErrors.length) {
      throw new Error('Failed to validate the play queue');
    }
    const { id: queueId } = await this.getOrCreatePlayQueue(guildId);
    return await this.dbService.playQueue.update({ where: { id: queueId }, data: { queue: updatedQueue } });
  }
}
