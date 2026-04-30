import { SlashCommandBuilder } from "discord.js";
import { LevelService } from "../services/level.service";
import type { Command } from "../types/Command";

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
        `🏅 Nível: ${data.level}`,
        `XP: ${data.xp}/${requiredXp}`,
        `XP necessário para o próximo nível: ${requiredXp - data.xp}`,
        `Total de mensagens: ${data.messages}`
      ].join("\n")
    );
  } catch (error) {
    console.error("Erro ao executar /rank:", error);
    await interaction.editReply("⚠️ Não consegui buscar o rank agora. Tente novamente em instantes.");
  }
};
