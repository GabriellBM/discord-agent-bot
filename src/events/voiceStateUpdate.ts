import { Events, VoiceState } from "discord.js";
import { musicService } from "../services/music.service";
import { logger } from "../utils/logger";

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState: VoiceState, newState: VoiceState) {
  try {
    const guild = newState.guild;
    const member = newState.member ?? oldState.member;

    await musicService.handleVoiceStateUpdate(guild.id);

    if (!member) {
      return;
    }

    if (!oldState.channelId && newState.channelId) {
      logger.info("VOICE", "JOIN", {
        user: member.displayName,
        userId: member.id,
        channel: newState.channel?.name,
        channelId: newState.channelId,
        guild: guild.name,
        microphone: !newState.selfMute,
        audio: !newState.selfDeaf,
        camera: newState.selfVideo,
        streaming: newState.streaming
      });
    } else if (oldState.channelId && !newState.channelId) {
      logger.info("VOICE", "LEAVE", {
        user: member.displayName,
        userId: member.id,
        channel: oldState.channel?.name,
        channelId: oldState.channelId,
        guild: guild.name,
        microphone: !oldState.selfMute,
        audio: !oldState.selfDeaf,
        camera: oldState.selfVideo,
        streaming: oldState.streaming
      });
    } else if (oldState.channelId !== newState.channelId) {
      logger.info("VOICE", "MOVE", {
        user: member.displayName,
        userId: member.id,
        from: oldState.channel?.name,
        to: newState.channel?.name,
        guild: guild.name,
        microphone: !newState.selfMute,
        audio: !newState.selfDeaf,
        camera: newState.selfVideo,
        streaming: newState.streaming
      });
    }

    if (oldState.serverMute !== newState.serverMute) {
      logger.info("VOICE", "SERVER_MUTE_CHANGED", {
        user: member.displayName,
        userId: member.id,
        channel: newState.channel?.name ?? oldState.channel?.name,
        guild: guild.name,
        serverMute: newState.serverMute
      });
    }

    if (oldState.serverDeaf !== newState.serverDeaf) {
      logger.info("VOICE", "SERVER_DEAF_CHANGED", {
        user: member.displayName,
        userId: member.id,
        channel: newState.channel?.name ?? oldState.channel?.name,
        guild: guild.name,
        serverDeaf: newState.serverDeaf
      });
    }

    if (oldState.selfMute !== newState.selfMute) {
      logger.info("VOICE", "MICROPHONE_CHANGED", {
        user: member.displayName,
        userId: member.id,
        channel: newState.channel?.name ?? oldState.channel?.name,
        guild: guild.name,
        microphone: !newState.selfMute
      });
    }

    if (oldState.selfDeaf !== newState.selfDeaf) {
      logger.info("VOICE", "AUDIO_CHANGED", {
        user: member.displayName,
        userId: member.id,
        channel: newState.channel?.name ?? oldState.channel?.name,
        guild: guild.name,
        audio: !newState.selfDeaf
      });
    }

    if (oldState.streaming !== newState.streaming) {
      logger.info("VOICE", "STREAMING_CHANGED", {
        user: member.displayName,
        userId: member.id,
        channel: newState.channel?.name ?? oldState.channel?.name,
        guild: guild.name,
        streaming: newState.streaming
      });
    }

    if (oldState.selfVideo !== newState.selfVideo) {
      logger.info("VOICE", "CAMERA_CHANGED", {
        user: member.displayName,
        userId: member.id,
        channel: newState.channel?.name ?? oldState.channel?.name,
        guild: guild.name,
        camera: newState.selfVideo
      });
    }
  } catch (error) {
    logger.error("VOICE", "VOICE_EVENT_FAILED", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
