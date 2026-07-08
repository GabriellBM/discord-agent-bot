import { Events, Message, PartialMessage } from "discord.js";
import { logger } from "../utils/logger";

export const name = Events.MessageDelete;
export const once = false;

export async function execute(message: Message | PartialMessage) {
  try {
    if (!message.guild) {
      return;
    }

    logger.warn("MODERATION", "MESSAGE_DELETED", {
      user: message.author?.tag,
      userId: message.author?.id,
      channelId: message.channel.id,
      guild: message.guild.name,
      content: message.content || "[content unavailable]"
    });
  } catch (error) {
    logger.error("MODERATION", "MESSAGE_DELETE_LOG_FAILED", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
