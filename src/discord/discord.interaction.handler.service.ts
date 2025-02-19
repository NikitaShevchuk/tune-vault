import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, ChatInputCommandInteraction, Interaction } from 'discord.js';

import { Commands, commands } from 'src/discord/constants';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordMessageService } from 'src/discord/discord.message.service';
import { UserService } from 'src/user/user.service';
import { DiscordPlayerService } from 'src/discord/player/discord.player.service';
import { InvalidLinkError, NotVoiceChannelMemberError } from './exceptions';
import { DiscordPlayerMessageService } from './player/discord.player.message.service';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { PlayerEvents } from './player/actions';

@Injectable()
export class DiscordInteractionHandlerService {
  private readonly logger = new Logger(DiscordInteractionHandlerService.name);

  constructor(
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
    private readonly userService: UserService,
    private readonly discordPlayerService: DiscordPlayerService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly playQueueService: PlayQueueService,
  ) {}

  public async handleInteraction(interaction: Interaction): Promise<void> {
    this.logger.log(
      `New interaction detected. Server ID: ${interaction.guildId}. Is command: ${interaction.isCommand()}. Is button: ${interaction.isButton()}.`,
    );
    await this.discordGuildService.updateActiveGuildBasedOnInteraction(interaction);
    this.userService.updateActiveGuildIdBasedOnInteraction(interaction);

    if (interaction.isChatInputCommand()) {
      return await this.handleCommandInteraction(interaction);
    }
    if (interaction.isButton()) {
      return this.handleButtonInteraction(interaction);
    }

    throw new Error('Unknown interaction type');
  }

  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const isPlayerButton = Object.values(PlayerEvents).includes(interaction.customId as PlayerEvents);
    if (!isPlayerButton) {
      throw new Error('Unknown button ID');
    }

    await this.handlePlayerButtonInteraction(interaction);
  }

  private async handlePlayerButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const message = await this.discordPlayerService.changePlayerState({
      action: interaction.customId,
      guildId: interaction.guildId,
    });

    const playerState = await this.discordPlayerService.getCurrentPlayerState(interaction.guildId);

    const sendMessagesRequests = [
      this.discordMessageService.replyAndDeleteAfterDelay({
        message,
        interaction,
        guildId: interaction.guildId,
      }),
      this.discordPlayerMessageService.sendCurrentTrackDetails({
        interaction,
        guildId: interaction.guildId,
        playerState,
      }),
    ];

    await Promise.all(sendMessagesRequests);
  }

  private async handleCommandInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const isUnknownCommand = !commands.find(({ name }) => name === interaction.commandName);
    if (isUnknownCommand) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: 'Command not found',
        guildId: interaction.guildId,
      });
      return;
    }

    if (interaction.commandName === Commands.REFRESH_COMMANDS) {
      await interaction.guild.commands.set(commands);
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: 'Commands refreshed',
        guildId: interaction.guildId,
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
        guildId: interaction.guildId,
      });
    }

    if ([Commands.PLAY, Commands.P].includes(interaction.commandName as Commands)) {
      await this.handlePlayCommand(interaction);
    }
  }

  private async handlePlayCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const hasItemsInTheQeue = await this.playQueueService.hasItemsInTheQueue(interaction.guildId);
    await this.discordMessageService.displayMessage({
      message: 'Loading details...',
      interaction,
      guildId: interaction.guildId,
      shouldDeleteAfterDelay: hasItemsInTheQeue,
    });

    try {
      const message = await this.discordPlayerService.playFromInteraction(interaction);
      if (message) {
        await this.discordMessageService.displayMessage({
          message,
          interaction,
          guildId: interaction.guildId,
        });
      }

      const playerState = await this.discordPlayerService.getCurrentPlayerState(interaction.guildId);
      await this.discordPlayerMessageService.sendCurrentTrackDetails({
        interaction,
        guildId: interaction.guildId,
        playerState,
      });
    } catch (e) {
      if (e instanceof NotVoiceChannelMemberError) {
        await this.discordMessageService.replyAndDeleteAfterDelay({
          interaction,
          message: '⛔ You must be in a voice channel to use this command',
          guildId: interaction.guildId,
        });
        return;
      }

      if (e instanceof InvalidLinkError) {
        await this.discordMessageService.replyAndDeleteAfterDelay({
          message: '⛔ Invalid link',
          interaction,
          guildId: interaction.guildId,
        });
        return;
      }

      throw e;
    }
  }
}
