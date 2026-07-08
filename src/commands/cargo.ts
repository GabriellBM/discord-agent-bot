import { GuildTextBasedChannel, SlashCommandBuilder } from "discord.js";
import { MAX_LEVEL_ROLE } from "../config/level.config";
import { LevelService } from "../services/level.service";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";

const levelService = new LevelService();

export const data = new SlashCommandBuilder()
  .setName("applyleigosenior")
  .setDescription("Solicita um cargo superior ao owner. Disponivel apenas para quem tem cargo MAX.");

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild || !interaction.channel?.isTextBased()) {
      await interaction.editReply("Este comando so pode ser usado em um canal de texto do servidor.");
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!member.roles.cache.has(MAX_LEVEL_ROLE.roleId)) {
      await interaction.editReply("Voce precisa ter o cargo MAX para solicitar o cargo superior.");
      return;
    }

    const requestResult = await levelService.requestHigherRoleApproval(
      member,
      interaction.channel as GuildTextBasedChannel
    );
    await interaction.editReply(requestResult.message);
  } catch (error) {
    logger.error("MODERATION", "HIGHER_ROLE_REQUEST_FAILED", {
      user: interaction.user.tag,
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui enviar sua solicitacao agora.");
  }
};
