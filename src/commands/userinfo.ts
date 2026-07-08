import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";

export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Mostra informacoes de um usuario.")
  .addUserOption((option) =>
    option.setName("usuario").setDescription("Usuario que sera consultado.").setRequired(true)
  );

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild) {
      await interaction.editReply("Este comando so pode ser usado em um servidor.");
      return;
    }

    const user = interaction.options.getUser("usuario", true);
    const member = await interaction.guild.members.fetch(user.id);
    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guild?.id)
      .sort((firstRole, secondRole) => secondRole.position - firstRole.position)
      .map((role) => role.toString());

    await interaction.editReply(
      [
        `Nome: ${user.tag}`,
        `ID: ${user.id}`,
        `Entrou em: ${member.joinedAt?.toLocaleDateString("pt-BR") ?? "Nao informado"}`,
        `Cargos: ${roles.length > 0 ? roles.join(", ") : "Nenhum cargo"}`
      ].join("\n")
    );
  } catch (error) {
    logger.error("DISCORD", "USER_INFO_FAILED", {
      user: interaction.user.tag,
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui buscar as informacoes desse usuario agora.");
  }
};
