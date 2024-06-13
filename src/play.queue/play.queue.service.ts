import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { GuildPlayQueue, PlayQueueItem } from 'src/play.queue/types';

const PLAY_QUEUE_REDIS_KEY = 'play-queue';

@Injectable()
export class PlayQueueService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  public async getQueue(guildId: string): Promise<PlayQueueItem[] | null> {
    const guildsPlayQueues = await this.cacheManager.get<GuildPlayQueue | null>(PLAY_QUEUE_REDIS_KEY);

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

  public async pushToQueue({ guildId, urls }: { guildId: string; urls: string[] | string }): Promise<void> {
    const queueItems = (Array.isArray(urls) ? urls : [urls]).map<PlayQueueItem>((url) => ({
      url,
      alreadyPlayed: false,
    }));

    const existingQueue = await this.getQueue(guildId);

    const updatedQueue = existingQueue ? [...existingQueue, ...queueItems] : queueItems;

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

    if (nextItemIndex === -1) {
      return null;
    }

    const updatedQueue = queue.map((item, i) => ({
      ...item,
      alreadyPlayed: markCurrentAsPlayed ? i <= nextItemIndex : i < nextItemIndex,
    }));

    const nextItem = queue[nextItemIndex];

    await this.updateQueueForGuild(guildId, updatedQueue);

    return nextItem;
  }

  public async getPrevItem(guildId: string): Promise<PlayQueueItem | null> {
    const queue = await this.getQueue(guildId);
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

    await this.updateQueueForGuild(guildId, updatedQueue);

    return prevItem;
  }

  public async destroyQueue(guildId: string): Promise<void> {
    const allGuildsPlayQueues = await this.cacheManager.get<GuildPlayQueue | null>(PLAY_QUEUE_REDIS_KEY);

    if (!allGuildsPlayQueues) {
      return;
    }

    delete allGuildsPlayQueues[guildId];

    await this.cacheManager.set(PLAY_QUEUE_REDIS_KEY, allGuildsPlayQueues);
  }

  public async markAsPlayed(guildId: string, url: string): Promise<void> {
    const queue = await this.getQueue(guildId);
    if (!queue) {
      return;
    }

    const updatedQueue = queue.map((item) => ({
      ...item,
      alreadyPlayed: item.url === url || item.alreadyPlayed,
    }));

    await this.updateQueueForGuild(guildId, updatedQueue);
  }

  private async updateQueueForGuild(guildId: string, updatedQueue: PlayQueueItem[]): Promise<void> {
    const allGuildsPlayQueues = await this.cacheManager.get<GuildPlayQueue | null>(PLAY_QUEUE_REDIS_KEY);

    const updatedGuildsPlayQueues = {
      ...(allGuildsPlayQueues ?? {}),
      [guildId]: updatedQueue,
    };

    await this.cacheManager.set(PLAY_QUEUE_REDIS_KEY, updatedGuildsPlayQueues);
  }
}
