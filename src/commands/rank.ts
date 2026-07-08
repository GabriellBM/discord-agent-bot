import { SlashCommandBuilder } from "discord.js";
import { LevelService } from "../services/level.service";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";

const levelService = new LevelService();

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("Mostra o rank de um usuario.")
  .addUserOption((option) =>
    option.setName("usuario").setDescription("Usuario que sera consultado.").setRequired(false)
  );

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild) {
      await interaction.editReply("Este comando so pode ser usado em um servidor.");
      return;
    }

    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const data = await levelService.getUser(interaction.guild.id, user.id);
    const requiredXp = levelService.getRequiredXp(data.level);

    await interaction.editReply(
      [
        `Rank de ${user.tag}`,
        `Nivel: ${data.level}`,
        `XP: ${data.xp}/${requiredXp}`,
        `XP necessario para o proximo nivel: ${requiredXp - data.xp}`,
        `Total de mensagens: ${data.messages}`
      ].join("\n")
    );
  } catch (error) {
    logger.error("MODERATION", "RANK_FAILED", {
      user: interaction.user.tag,
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui buscar o rank agora. Tente novamente em instantes.");
  }
};
