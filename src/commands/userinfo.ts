import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";

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
      await interaction.editReply("⚠️ Este comando só pode ser usado em um servidor.");
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
        `👤 Nome: ${user.tag}`,
        `ID: ${user.id}`,
        `Entrou em: ${member.joinedAt?.toLocaleDateString("pt-BR") ?? "Não informado"}`,
        `Cargos: ${roles.length > 0 ? roles.join(", ") : "Nenhum cargo"}`
      ].join("\n")
    );
  } catch (error) {
    console.error("Erro ao executar /userinfo:", error);
    await interaction.editReply("⚠️ Não consegui buscar as informações desse usuário agora.");
  }
};
