import { User as DiscordUser } from 'discord.js';

declare global {
  namespace Express {
    interface User extends DiscordUser {}
  }
}
