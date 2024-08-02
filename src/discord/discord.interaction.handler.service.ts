import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, GuildMember, Interaction } from 'discord.js';

import { Commands, commands } from 'src/discord/constants';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordMessageService } from 'src/discord/discord.message.service';
import { UserService } from 'src/user/user.service';
import { DiscordPlayerService } from 'src/discord/player/discord.player.service';

@Injectable()
export class DiscordInteractionHandlerService {
  private readonly logger = new Logger(DiscordInteractionHandlerService.name);

  constructor(
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
    private readonly userService: UserService,
    private readonly discordPlayerService: DiscordPlayerService,
  ) {}

  public async handleInteraction(interaction: Interaction): Promise<void> {
    this.logger.log(
      `New interaction detected. Server ID: ${interaction.guildId}. Is command: ${interaction.isCommand()}. Is button: ${interaction.isButton()}.`,
    );
    this.discordGuildService.updateActiveGuildBasedOnInteraction(interaction);
    this.userService.updateActiveGuildIdBasedOnInteraction(interaction);

    if (interaction.isCommand()) {
      await this.handleCommandInteraction(interaction);
      return;
    }
    if (interaction.isButton()) {
      await this.discordPlayerService.changePlayerState({
        action: interaction.customId,
        interaction,
        userId: undefined,
      });
      return;
    }

    this.logger.error('Unknown interaction type.');
  }

  private async handleCommandInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const isUnknownCommand = !commands.find(({ name }) => name === interaction.commandName);
    if (isUnknownCommand) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: 'Command not found',
        userId: undefined,
      });
      return;
    }

    if (interaction.commandName === Commands.REFRESH_COMMANDS) {
      interaction.guild.commands.set(commands);
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: 'Commands refreshed',
        userId: undefined,
      });
    }

    if (interaction.commandName === Commands.AUTH) {
      const authButton = this.discordMessageService.getAuthButton();
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: {
          components: [authButton],
          content: 'Click the button below to authorize the bot.',
        },
        delayMs: 60_000, // 1 minute
        userId: undefined,
      });
    }

    if ([Commands.PLAY, Commands.P].includes(interaction.commandName as Commands)) {
      this.playFromInteraction(interaction);
    }
  }

  private async playFromInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: '⛔ You must be in a voice channel to use this command',
        userId: undefined,
      });
      return;
    }

    await this.discordPlayerService.play({ interaction, url: userInput, userId: undefined });
  }
}
