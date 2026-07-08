import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Mostra informacoes do servidor.");

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.editReply("Este comando so pode ser usado em um servidor.");
      return;
    }

    await interaction.editReply(
      [
        `Nome: ${guild.name}`,
        `Total de membros: ${guild.memberCount}`,
        `Criado em: ${guild.createdAt.toLocaleDateString("pt-BR")}`
      ].join("\n")
    );
  } catch (error) {
    logger.error("DISCORD", "SERVER_INFO_FAILED", {
      user: interaction.user.tag,
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui buscar as informacoes do servidor agora.");
  }
};
