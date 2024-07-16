import { PlayQueue as DefaultPlayQueueType } from '@prisma/client';

export type PlayQueueType = Array<{
  url: string;
  alreadyPlayed: boolean;
}>;

declare global {
  namespace PrismaJson {
    type PlayQueueType = PlayQueueType;
  }
  interface PlayQueue extends DefaultPlayQueueType {
    queue: PlayQueueType;
  }
}
