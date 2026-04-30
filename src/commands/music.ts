import { SlashCommandBuilder } from "discord.js";
import { musicService } from "../services/music.service";
import { LoopMode } from "../types/music.types";
import type { Command } from "../types/Command";

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Sistema de música do servidor.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("play")
      .setDescription("Toca uma música por link do YouTube.")
      .addStringOption((option) =>
        option
          .setName("url")
          .setDescription("Link do YouTube.")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("playlist")
      .setDescription("Mostra a playlist atual.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("nowplaying")
      .setDescription("Mostra a música atual.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("pause")
      .setDescription("Pausa a música atual.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("resume")
      .setDescription("Retoma a música pausada.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("skip")
      .setDescription("Pula a música atual com votação ou força do owner.")
      .addBooleanOption((option) =>
        option
          .setName("force")
          .setDescription("Apenas o owner pode pular imediatamente.")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stop")
      .setDescription("Para a música, limpa a playlist e desconecta o bot.")
      .addBooleanOption((option) =>
        option
          .setName("force")
          .setDescription("Apenas o owner pode parar imediatamente.")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("leave")
      .setDescription("Desconecta o bot do canal de voz.")
      .addBooleanOption((option) =>
        option
          .setName("force")
          .setDescription("Apenas o owner pode sair imediatamente.")
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("volume")
      .setDescription("Ajusta o volume atual e das próximas músicas.")
      .addIntegerOption((option) =>
        option
          .setName("valor")
          .setDescription("Volume entre 1 e 100.")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("loop")
      .setDescription("Altera o modo de repetição.")
      .addStringOption((option) =>
        option
          .setName("modo")
          .setDescription("Modo de repetição.")
          .setRequired(true)
          .addChoices(
            { name: "off", value: "off" },
            { name: "track", value: "track" },
            { name: "playlist", value: "playlist" }
          )
      )
  );

export const execute: Command["execute"] = async (interaction) => {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "play") {
    await musicService.play(interaction, interaction.options.getString("url", true));
    return;
  }

  if (subcommand === "playlist") {
    await musicService.showPlaylist(interaction);
    return;
  }

  if (subcommand === "nowplaying") {
    await musicService.nowPlaying(interaction);
    return;
  }

  if (subcommand === "pause") {
    await musicService.pause(interaction);
    return;
  }

  if (subcommand === "resume") {
    await musicService.resume(interaction);
    return;
  }

  if (subcommand === "skip") {
    await musicService.skip(interaction, interaction.options.getBoolean("force") ?? false);
    return;
  }

  if (subcommand === "stop") {
    await musicService.stop(interaction, interaction.options.getBoolean("force") ?? false);
    return;
  }

  if (subcommand === "leave") {
    await musicService.leave(interaction, interaction.options.getBoolean("force") ?? false);
    return;
  }

  if (subcommand === "volume") {
    await musicService.setVolume(interaction, interaction.options.getInteger("valor", true));
    return;
  }

  await musicService.setLoop(interaction, interaction.options.getString("modo", true) as LoopMode);
};
