import { AudioPlayer, VoiceConnection } from "@discordjs/voice";
import { Guild } from "discord.js";

export type LoopMode = "off" | "track" | "playlist";
export type MusicVoteType = "skip" | "stop" | "leave";

export interface Track {
  title: string;
  url: string;
  originalUrl?: string;
  requestedBy: string;
  duration?: string;
}

export interface GuildMusicState {
  guild?: Guild;
  queue: Track[];
  history: Track[];
  currentTrack?: Track;
  connection?: VoiceConnection;
  player: AudioPlayer;
  textChannelId?: string;
  voiceChannelId?: string;
  idleTimeout?: NodeJS.Timeout;
  voiceEmptyTimeout?: NodeJS.Timeout;
  volume: number;
  loopMode: LoopMode;
  vote?: MusicVoteState;
}

export interface MusicVoteState {
  type: MusicVoteType;
  messageId: string;
  channelId: string;
  voiceChannelId: string;
  yesVotes: Set<string>;
  noVotes: Set<string>;
  createdBy: string;
  expiresAt: number;
}
