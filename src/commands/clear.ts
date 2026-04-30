import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import {
  checkBotPermission,
  checkUserPermission,
  moderationPermissions
} from "../utils/permission.util";
import type { Command } from "../types/Command";

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
      await interaction.editReply("⚠️ Este comando só pode ser usado em um servidor.");
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
      await interaction.editReply("⚠️ Não consigo apagar mensagens neste canal.");
      return;
    }

    const amount = interaction.options.getInteger("quantidade", true);
    const deletedMessages = await channel.bulkDelete(amount, true);

    console.log(`${deletedMessages.size} mensagem(ns) apagada(s) por ${interaction.user.tag}.`);
    await interaction.editReply(`🧹 ${deletedMessages.size} mensagem(ns) apagada(s).`);
  } catch (error) {
    console.error("Erro ao executar /clear:", error);
    await interaction.editReply("⚠️ Não consegui apagar as mensagens. Verifique se elas não são antigas demais.");
  }
};
