import { ApplicationCommandOptionData, ChatInputApplicationCommandData, IntentsBitField } from 'discord.js';

export enum Commands {
  PLAY = 'play',
  P = 'p',
  REFRESH_COMMANDS = 'refreshcommands',
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
];

export const intents = [
  IntentsBitField.Flags.Guilds,
  IntentsBitField.Flags.GuildMessages,
  IntentsBitField.Flags.MessageContent,
  IntentsBitField.Flags.GuildMembers,
  IntentsBitField.Flags.GuildVoiceStates,
];

export enum ButtonIds {
  PREVIOUS = 'previous',
  PLAY_PAUSE = 'play-pause',
  NEXT = 'next',
  DISCONNECT = 'disconnect',
}

export const INTERACTION_REPLY_TIMEOUT_MS = 5_000;
