import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";
import { moderationPermissions, validateModerationAction } from "../utils/permission.util";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Bane um usuario do servidor.")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((option) =>
    option.setName("usuario").setDescription("Usuario que sera banido.").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("motivo").setDescription("Motivo do banimento.").setRequired(true)
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
      permission: moderationPermissions.ban,
      action: "ban"
    });

    if (!canModerate) {
      return;
    }

    await targetMember.ban({ reason });
    logger.warn("MODERATION", "BAN", {
      user: user.tag,
      userId: user.id,
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      guild: interaction.guild.name,
      reason
    });
    await interaction.editReply(`${user.tag} foi banido. Motivo: ${reason}`);
  } catch (error) {
    logger.error("MODERATION", "BAN_FAILED", {
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui banir esse usuario. Tente novamente em instantes.");
  }
};
