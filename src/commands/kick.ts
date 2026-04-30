import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { moderationPermissions, validateModerationAction } from "../utils/permission.util";
import type { Command } from "../types/Command";

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
      await interaction.editReply("⚠️ Este comando só pode ser usado em um servidor.");
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
    console.log(`Usuario ${user.tag} expulso por ${interaction.user.tag}. Motivo: ${reason}`);
    await interaction.editReply(`✅ ${user.tag} foi expulso. Motivo: ${reason}`);
  } catch (error) {
    console.error("Erro ao executar /kick:", error);
    await interaction.editReply("⚠️ Não consegui expulsar esse usuário. Tente novamente em instantes.");
  }
};
