export interface GuildPlayQueue {
  [guildId: string]: PlayQueueItem[];
}

export interface PlayQueueItem {
  url: string;
  alreadyPlayed: boolean;
}
