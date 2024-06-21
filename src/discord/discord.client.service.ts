import { Injectable } from '@nestjs/common';
import { Client } from 'discord.js';

import { intents } from 'src/discord/constants';

@Injectable()
export class DiscordClientService {
  public readonly client = new Client({ intents });
}
