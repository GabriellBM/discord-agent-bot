import { Events, Message, PartialMessage } from "discord.js";
import { logger } from "../utils/logger";

export const name = Events.MessageUpdate;
export const once = false;

export async function execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
  try {
    if (!newMessage.guild) {
      return;
    }

    if (oldMessage.content === newMessage.content) {
      return;
    }

    logger.info("MODERATION", "MESSAGE_UPDATED", {
      user: newMessage.author?.tag ?? oldMessage.author?.tag,
      userId: newMessage.author?.id ?? oldMessage.author?.id,
      channelId: newMessage.channel.id,
      guild: newMessage.guild.name,
      before: oldMessage.content || "[content unavailable]",
      after: newMessage.content || "[content unavailable]"
    });
  } catch (error) {
    logger.error("MODERATION", "MESSAGE_UPDATE_LOG_FAILED", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
