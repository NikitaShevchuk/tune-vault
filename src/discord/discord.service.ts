import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';
import { Injectable, Logger } from '@nestjs/common';
import { Client, GuildMember, IntentsBitField, Interaction } from 'discord.js';
import { join } from 'path';
// import * as ytdl from 'ytdl-core';

enum Commands {
  PING = 'ping',
  GLORY_UKRAINE = 'slavaukraini',
  PLAY = 'play',
  P = 'p',
}

@Injectable()
export class DiscordService {
  private readonly intents = [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildVoiceStates,
  ];
  private readonly commands = [
    {
      name: Commands.PING,
      description: 'Replies with Pong!',
    },
    {
      name: Commands.GLORY_UKRAINE,
      description: 'Replies with Geroyam Slava!',
    },
    {
      name: Commands.PLAY,
      description: 'Plays music from link',
    },
    {
      name: Commands.P,
      description:
        'Plays music from YouTube link. Shortcut for the /play command',
    },
  ];

  private readonly logger = new Logger(DiscordService.name);
  private readonly client = new Client({
    intents: this.intents,
  });
  // private readonly discordRest = new REST({ version: '10' }).setToken(
  //   process.env.DISCORD_BOT_TOKEN,
  // );

  public initialize() {
    this.client.login(process.env.DISCORD_BOT_TOKEN);
    this.client.on('ready', () => {
      this.logger.log(`🚀 Logged in as 🟢${this.client.user.tag}`);
    });

    this.client.on('messageCreate', (message) => {
      if (message.author.bot) {
        return;
      }
      this.logger.log(message.content);
      message.reply('іді нахуй');
    });

    this.client.on('guildCreate', (guild) => {
      this.logger.log(`👋 Joined server: ${guild.name}`);
      console.log(this.commands);
      guild.commands.set(this.commands);
    });
    this.client.on('interactionCreate', (interaction) =>
      this.handleCommand(interaction),
    );
  }

  private handleCommand(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const isUnknownCommand = !this.commands.find(
      ({ name }) => name === interaction.commandName,
    );
    if (isUnknownCommand) {
      interaction.reply('Command not found');
      return;
    }

    if (interaction.commandName === Commands.PING) {
      interaction.reply('Pong!');
    }
    if (interaction.commandName === Commands.GLORY_UKRAINE) {
      interaction.reply('Geroyam Slava!');
    }
    if (
      [Commands.PLAY, Commands.P].includes(interaction.commandName as Commands)
    ) {
      interaction.reply('Coming soon...');
      const connection = joinVoiceChannel({
        channelId: (interaction.member as GuildMember).voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      // const stream = ytdl(
      //   'https://www.youtube.com/watch?v=4kIG3rtyBAA&ab_channel=%D0%90%D0%BD%D0%B0%D1%80%D1%85%D0%B8%D1%81%D1%82LIVE',
      //   { filter: 'audioonly' },
      // );

      const resource = createAudioResource(
        join(process.cwd(), './src/images/test.ogg'),
      );

      player.play(resource);
      // player.on(AudioPlayerStatus.Idle, () => {
      //   connection.destroy();
      // });

      setTimeout(() => connection.destroy(), 20_000);
    }
  }
}
