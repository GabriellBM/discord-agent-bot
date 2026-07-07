import { SlashCommandBuilder } from "discord.js";
import { LevelService } from "../services/level.service";
import type { Command } from "../types/Command";

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
      await interaction.editReply("📭 Ainda não há dados de XP neste servidor.");
      return;
    }

    const lines = leaderboard.map(({ member, data }, index) => {
      return `${index + 1}. ${member.displayName} - Nível ${data.level} (${data.xp} XP)`;
    });

    await interaction.editReply(["🏆 Top 10 de XP", ...lines].join("\n"));
  } catch (error) {
    console.error("Erro ao executar /leaderboard:", error);
    await interaction.editReply("⚠️ Não consegui buscar o top 10 agora. Tente novamente em instantes.");
  }
};
