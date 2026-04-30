import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { moderationPermissions, validateModerationAction } from "../utils/permission.util";
import type { Command } from "../types/Command";

const millisecondsPerMinute = 60 * 1000;
const maxTimeoutMinutes = 28 * 24 * 60;

export const data = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Aplica timeout em um usuario.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) =>
    option.setName("usuario").setDescription("Usuario que recebera timeout.").setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName("minutos")
      .setDescription("Duracao do timeout em minutos.")
      .setMinValue(1)
      .setMaxValue(maxTimeoutMinutes)
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("motivo").setDescription("Motivo do timeout.").setRequired(true)
  );

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild) {
      await interaction.editReply("⚠️ Este comando só pode ser usado em um servidor.");
      return;
    }

    const user = interaction.options.getUser("usuario", true);
    const minutes = interaction.options.getInteger("minutos", true);
    const reason = interaction.options.getString("motivo", true);
    const targetMember = await interaction.guild.members.fetch(user.id);

    if (minutes < 1 || minutes > maxTimeoutMinutes) {
      await interaction.editReply("⚠️ Informe uma duração entre 1 minuto e 28 dias.");
      return;
    }

    const canModerate = await validateModerationAction(interaction, targetMember, {
      permission: moderationPermissions.timeout,
      action: "timeout"
    });

    if (!canModerate) {
      return;
    }

    await targetMember.timeout(minutes * millisecondsPerMinute, reason);
    console.log(
      `Timeout aplicado em ${user.tag} por ${interaction.user.tag}. Minutos: ${minutes}. Motivo: ${reason}`
    );
    await interaction.editReply(`✅ ${user.tag} recebeu timeout por ${minutes} minuto(s). Motivo: ${reason}`);
  } catch (error) {
    console.error("Erro ao executar /timeout:", error);
    await interaction.editReply("⚠️ Não consegui aplicar timeout nesse usuário. Tente novamente em instantes.");
  }
};
