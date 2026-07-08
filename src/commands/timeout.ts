import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";
import { moderationPermissions, validateModerationAction } from "../utils/permission.util";

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
      await interaction.editReply("Este comando so pode ser usado em um servidor.");
      return;
    }

    const user = interaction.options.getUser("usuario", true);
    const minutes = interaction.options.getInteger("minutos", true);
    const reason = interaction.options.getString("motivo", true);
    const targetMember = await interaction.guild.members.fetch(user.id);

    if (minutes < 1 || minutes > maxTimeoutMinutes) {
      await interaction.editReply("Informe uma duracao entre 1 minuto e 28 dias.");
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
    logger.warn("MODERATION", "TIMEOUT", {
      user: user.tag,
      userId: user.id,
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      guild: interaction.guild.name,
      minutes,
      reason
    });
    await interaction.editReply(`${user.tag} recebeu timeout por ${minutes} minuto(s). Motivo: ${reason}`);
  } catch (error) {
    logger.error("MODERATION", "TIMEOUT_FAILED", {
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui aplicar timeout nesse usuario. Tente novamente em instantes.");
  }
};
