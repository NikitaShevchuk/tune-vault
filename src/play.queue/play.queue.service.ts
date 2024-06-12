import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { GuildPlayQueue, PlayQueueItem } from 'src/play.queue/types';

const PLAY_QUEUE_REDIS_KEY = 'play-queue';

@Injectable()
export class PlayQueueService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  public async getQueue(guildId: string): Promise<PlayQueueItem[] | null> {
    const guildsPlayQueues = await this.cacheManager.get<GuildPlayQueue | null>(
      PLAY_QUEUE_REDIS_KEY,
    );

    if (!guildsPlayQueues) {
      return null;
    }

    return guildsPlayQueues[guildId] ?? null;
  }

  public async getCurrentItem(guildId: string): Promise<PlayQueueItem | null> {
    const queue = await this.getQueue(guildId);
    if (!queue || !queue.length) {
      return null;
    }

    return queue.filter((item) => item.alreadyPlayed).at(-1);
  }

  public async pushToQueue({
    guildId,
    urls,
    markAsPlayedByDefault,
  }: {
    guildId: string;
    urls: string[] | string;
    markAsPlayedByDefault?: boolean;
  }): Promise<void> {
    const queueItems = (Array.isArray(urls) ? urls : [urls]).map<PlayQueueItem>(
      (url) => ({ url, alreadyPlayed: Boolean(markAsPlayedByDefault) }),
    );

    const existingQueue = await this.getQueue(guildId);

    const updatedQueue = existingQueue
      ? [...existingQueue, ...queueItems]
      : queueItems;

    await this.updateQueueForGuild(guildId, updatedQueue);
  }

  public async getNextItem({
    guildId,
    markCurrentAsPlayed = true,
  }: {
    guildId: string;
    markCurrentAsPlayed?: boolean;
  }): Promise<PlayQueueItem | null> {
    const queue = await this.getQueue(guildId);
    if (!queue) {
      return null;
    }

    const nextItemIndex = queue.findIndex((item) => !item.alreadyPlayed);
    const updatedQueue = queue.map((item, i) => ({
      ...item,
      alreadyPlayed: markCurrentAsPlayed
        ? i <= nextItemIndex
        : i < nextItemIndex,
    }));

    const nextItem = queue[nextItemIndex];

    await this.updateQueueForGuild(guildId, updatedQueue);

    return nextItem;
  }

  public async destroyQueue(guildId: string): Promise<void> {
    const allGuildsPlayQueues =
      await this.cacheManager.get<GuildPlayQueue | null>(PLAY_QUEUE_REDIS_KEY);

    if (!allGuildsPlayQueues) {
      return;
    }

    delete allGuildsPlayQueues[guildId];

    await this.cacheManager.set(PLAY_QUEUE_REDIS_KEY, allGuildsPlayQueues);
  }

  private async updateQueueForGuild(
    guildId: string,
    updatedQueue: PlayQueueItem[],
  ): Promise<void> {
    const allGuildsPlayQueues =
      await this.cacheManager.get<GuildPlayQueue | null>(PLAY_QUEUE_REDIS_KEY);

    const updatedGuildsPlayQueues = {
      ...(allGuildsPlayQueues ?? {}),
      [guildId]: updatedQueue,
    };

    await this.cacheManager.set(PLAY_QUEUE_REDIS_KEY, updatedGuildsPlayQueues);
  }
}
