import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";
import {
  checkBotPermission,
  checkUserPermission,
  moderationPermissions
} from "../utils/permission.util";

export const data = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("Apaga mensagens recentes do canal.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption((option) =>
    option
      .setName("quantidade")
      .setDescription("Quantidade de mensagens para apagar.")
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(true)
  );

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild) {
      await interaction.editReply("Este comando so pode ser usado em um servidor.");
      return;
    }

    if (!(await checkUserPermission(interaction, moderationPermissions.clear))) {
      return;
    }

    if (!(await checkBotPermission(interaction, moderationPermissions.clear))) {
      return;
    }

    const channel = interaction.channel;

    if (!channel || !("bulkDelete" in channel)) {
      await interaction.editReply("Nao consigo apagar mensagens neste canal.");
      return;
    }

    const amount = interaction.options.getInteger("quantidade", true);
    const deletedMessages = await channel.bulkDelete(amount, true);

    logger.warn("MODERATION", "MESSAGES_BULK_DELETED", {
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      channelId: interaction.channelId,
      guild: interaction.guild.name,
      requested: amount,
      deleted: deletedMessages.size
    });
    await interaction.editReply(`${deletedMessages.size} mensagem(ns) apagada(s).`);
  } catch (error) {
    logger.error("MODERATION", "CLEAR_FAILED", {
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      channelId: interaction.channelId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui apagar as mensagens. Verifique se elas nao sao antigas demais.");
  }
};
