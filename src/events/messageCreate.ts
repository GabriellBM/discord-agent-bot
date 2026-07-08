import { Events, Message } from "discord.js";
import { AutomodService } from "../services/automod.service";
import { LevelService } from "../services/level.service";
import { fetchPublicBotChannel } from "../utils/bot-channel.util";
import { logger } from "../utils/logger";

const automodService = new AutomodService();
const levelService = new LevelService();

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  try {
    if (message.author.bot || !message.inGuild()) {
      return;
    }

    const member = message.member ?? (await message.guild.members.fetch(message.author.id));

    logger.debug("DISCORD", "MESSAGE_RECEIVED", {
      user: message.author.tag,
      userId: message.author.id,
      channelId: message.channel.id,
      guild: message.guild.name,
      content: message.content || "[no text content]"
    });

    const handledByAutomod = await automodService.handleMessage(message);

    if (handledByAutomod) {
      return;
    }

    const result = await levelService.addMessageXp(message.guild.id, message.author.id);

    if (!result.onCooldown) {
      await levelService.applyLevelRoles(member, result.data.level);
      logger.info("MODERATION", "XP_GAINED", {
        user: message.author.tag,
        userId: message.author.id,
        channelId: message.channel.id,
        guild: message.guild.name,
        gainedXp: result.gainedXp,
        level: result.data.level,
        xp: result.data.xp,
        requiredXp: levelService.getRequiredXp(result.data.level)
      });
    }

    if (!result.leveledUp) {
      return;
    }

    const publicBotChannel = await fetchPublicBotChannel(message.guild, message.channel.id);

    if (publicBotChannel) {
      try {
        await publicBotChannel.send(
          `Parabens, ${message.author}! Voce subiu para o nivel ${result.data.level}.`
        );
      } catch (error) {
        logger.error("MODERATION", "LEVEL_UP_MESSAGE_FAILED", {
          user: message.author.tag,
          userId: message.author.id,
          channelId: publicBotChannel.id,
          guild: message.guild.name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    } else {
      logger.warn("MODERATION", "LEVEL_UP_MESSAGE_SKIPPED", {
        user: message.author.tag,
        userId: message.author.id,
        channelId: message.channel.id,
        guild: message.guild.name,
        reason: "text channel unavailable"
      });
    }

    logger.success("MODERATION", "LEVEL_UP", {
      user: message.author.tag,
      userId: message.author.id,
      channelId: message.channel.id,
      guild: message.guild.name,
      level: result.data.level
    });

    if (message.channel.isTextBased()) {
      await levelService.requestMaxRoleApproval(member, result.data.level, message.channel);
    }
  } catch (error) {
    logger.error("MODERATION", "MESSAGE_XP_FAILED", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
