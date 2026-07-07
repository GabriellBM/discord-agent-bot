import { Guild, GuildTextBasedChannel } from "discord.js";
import { env } from "../config/env";

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
    console.error("Erro ao buscar canal publico do bot:", error);
    return null;
  }
}
