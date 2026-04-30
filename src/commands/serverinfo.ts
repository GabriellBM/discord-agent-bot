import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Mostra informacoes do servidor.");

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.editReply("⚠️ Este comando só pode ser usado em um servidor.");
      return;
    }

    await interaction.editReply(
      [
        `🏷️ Nome: ${guild.name}`,
        `Total de membros: ${guild.memberCount}`,
        `Criado em: ${guild.createdAt.toLocaleDateString("pt-BR")}`
      ].join("\n")
    );
  } catch (error) {
    console.error("Erro ao executar /serverinfo:", error);
    await interaction.editReply("⚠️ Não consegui buscar as informações do servidor agora.");
  }
};
