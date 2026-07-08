import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";
import { moderationPermissions, validateModerationAction } from "../utils/permission.util";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Expulsa um usuario do servidor.")
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((option) =>
    option.setName("usuario").setDescription("Usuario que sera expulso.").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("motivo").setDescription("Motivo da expulsao.").setRequired(true)
  );

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild) {
      await interaction.editReply("Este comando so pode ser usado em um servidor.");
      return;
    }

    const user = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("motivo", true);
    const targetMember = await interaction.guild.members.fetch(user.id);

    const canModerate = await validateModerationAction(interaction, targetMember, {
      permission: moderationPermissions.kick,
      action: "kick"
    });

    if (!canModerate) {
      return;
    }

    await targetMember.kick(reason);
    logger.warn("MODERATION", "KICK", {
      user: user.tag,
      userId: user.id,
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      guild: interaction.guild.name,
      reason
    });
    await interaction.editReply(`${user.tag} foi expulso. Motivo: ${reason}`);
  } catch (error) {
    logger.error("MODERATION", "KICK_FAILED", {
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui expulsar esse usuario. Tente novamente em instantes.");
  }
};
