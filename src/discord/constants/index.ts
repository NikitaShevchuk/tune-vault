import { ApplicationCommandOptionData, ChatInputApplicationCommandData, IntentsBitField } from 'discord.js';

export enum Commands {
  PLAY = 'play',
  P = 'p',
  REFRESH_COMMANDS = 'refreshcommands',
  AUTH = 'auth',
}

export const playCommandOptions: ApplicationCommandOptionData[] = [
  { name: 'link', description: 'YouTube link', type: 3, required: true },
];

export const commands: ChatInputApplicationCommandData[] = [
  {
    name: Commands.PLAY,
    description: 'Plays music from a link or performs a search based on a query',
    options: playCommandOptions,
  },
  {
    name: Commands.P,
    description: 'Shortcut for the /play command',
    options: playCommandOptions,
  },
  {
    name: Commands.REFRESH_COMMANDS,
    description: 'Refresh the commands list',
  },
  {
    name: Commands.AUTH,
    description: 'Authorize to use the Tune Vault Chrome Extension',
  },
];

export const intents = [
  IntentsBitField.Flags.Guilds,
  IntentsBitField.Flags.GuildMessages,
  IntentsBitField.Flags.MessageContent,
  IntentsBitField.Flags.GuildMembers,
  IntentsBitField.Flags.GuildVoiceStates,
];

export const INTERACTION_REPLY_TIMEOUT_MS = 5_000;

export const DISCORD_USER_URL = 'https://discord.com/api/users/@me';
export const DISCORD_AUTH_URL = 'https://discord.com/oauth2/authorize';
