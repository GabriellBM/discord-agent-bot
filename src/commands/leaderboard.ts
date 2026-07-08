import { SlashCommandBuilder } from "discord.js";
import { LevelService } from "../services/level.service";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";

const levelService = new LevelService();

export const data = new SlashCommandBuilder()
  .setName("top10")
  .setDescription("Mostra o top 10 usuarios por nivel e XP.");

export const execute: Command["execute"] = async (interaction) => {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Este comando so pode ser usado em um servidor.",
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const leaderboard = await levelService.getLeaderboard(interaction.guild, 10);

    if (leaderboard.length === 0) {
      await interaction.editReply("Ainda nao ha dados de XP neste servidor.");
      return;
    }

    const lines = leaderboard.map(({ member, data }, index) => {
      return `${index + 1}. ${member.displayName} - Nivel ${data.level} (${data.xp} XP)`;
    });

    await interaction.editReply(["Top 10 de XP", ...lines].join("\n"));
  } catch (error) {
    logger.error("MODERATION", "LEADERBOARD_FAILED", {
      user: interaction.user.tag,
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui buscar o top 10 agora. Tente novamente em instantes.");
  }
};
