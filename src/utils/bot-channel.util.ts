import { Guild, GuildTextBasedChannel } from "discord.js";
import { env } from "../config/env";
import { logger } from "./logger";

export async function fetchPublicBotChannel(guild: Guild, fallbackChannelId?: string) {
  const channelId = env.botInteractionChannelId ?? fallbackChannelId;

  if (!channelId) {
    return null;
  }

  try {
    const channel = await guild.channels.fetch(channelId);

    if (channel?.isTextBased() && "send" in channel) {
      return channel as GuildTextBasedChannel;
    }

    return null;
  } catch (error) {
    logger.error("DISCORD", "CHANNEL_FETCH_FAILED", {
      guild: guild.name,
      channelId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}
