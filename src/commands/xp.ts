import { GuildMember, GuildTextBasedChannel, SlashCommandBuilder } from "discord.js";
import { LevelService } from "../services/level.service";
import type { Command } from "../types/Command";
import { logger } from "../utils/logger";

const levelService = new LevelService();

export const data = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("Gerencia XP manualmente.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Adiciona XP a um usuario.")
      .addUserOption((option) =>
        option.setName("usuario").setDescription("Usuario que recebera XP.").setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName("quantidade").setDescription("Quantidade de XP.").setMinValue(1).setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("motivo").setDescription("Motivo da alteracao.").setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remove XP de um usuario.")
      .addUserOption((option) =>
        option.setName("usuario").setDescription("Usuario que perdera XP.").setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName("quantidade").setDescription("Quantidade de XP.").setMinValue(1).setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("motivo").setDescription("Motivo da alteracao.").setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set")
      .setDescription("Define o XP atual de um usuario.")
      .addUserOption((option) =>
        option.setName("usuario").setDescription("Usuario que tera XP definido.").setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName("quantidade").setDescription("Quantidade de XP.").setMinValue(0).setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("motivo").setDescription("Motivo da alteracao.").setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("reset")
      .setDescription("Reseta XP, nivel e mensagens de um usuario.")
      .addUserOption((option) =>
        option.setName("usuario").setDescription("Usuario que sera resetado.").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("motivo").setDescription("Motivo do reset.").setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("sync")
      .setDescription("Sincroniza os cargos de level de um usuario.")
      .addUserOption((option) =>
        option.setName("usuario").setDescription("Usuario que tera cargos sincronizados.").setRequired(true)
      )
  );

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild) {
      await interaction.editReply("Este comando so pode ser usado em um servidor.");
      return;
    }

    if (interaction.user.id !== interaction.guild.ownerId) {
      await interaction.editReply("Apenas o dono do servidor pode usar este comando.");
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("motivo") ?? "Sem motivo informado.";
    const member = await interaction.guild.members.fetch(user.id);

    if (subcommand === "sync") {
      const data = await levelService.getUser(interaction.guild.id, user.id);
      const removedRoles = await levelService.removeInvalidLevelRoles(member, data.level);

      await levelService.applyLevelRoles(member, data.level);
      if (interaction.channel?.isTextBased()) {
        await levelService.requestMaxRoleApproval(
          member,
          data.level,
          interaction.channel as GuildTextBasedChannel
        );
      }

      await notifyRemovedRoles(member, removedRoles);
      logger.info("MODERATION", "XP_SYNC", {
        moderator: interaction.user.tag,
        moderatorId: interaction.user.id,
        user: user.tag,
        userId: user.id,
        guild: interaction.guild.name,
        level: data.level,
        removedRoles: removedRoles.length
      });
      await interaction.editReply(`Cargos de nivel sincronizados para ${user.tag}. Nivel atual: ${data.level}.`);
      return;
    }

    if (subcommand === "reset") {
      const data = await levelService.resetUserLevel(interaction.guild.id, user.id);
      const removedRoles = await levelService.removeInvalidLevelRoles(member, data.level);

      await notifyRemovedRoles(member, removedRoles);
      logger.warn("MODERATION", "XP_RESET", {
        moderator: interaction.user.tag,
        moderatorId: interaction.user.id,
        user: user.tag,
        userId: user.id,
        guild: interaction.guild.name,
        reason,
        removedRoles: removedRoles.length,
        level: data.level,
        xp: data.xp,
        messages: data.messages
      });
      await interaction.editReply(
        `${user.tag} foi resetado. Nivel: ${data.level}, XP: ${data.xp}, mensagens: ${data.messages}.`
      );
      return;
    }

    const amount = interaction.options.getInteger("quantidade", true);
    const previousData = await levelService.getUser(interaction.guild.id, user.id);
    const previousLevel = previousData.level;
    const handlers = {
      add: () => levelService.addUserXp(interaction.guild!.id, user.id, amount),
      remove: () => levelService.removeUserXp(interaction.guild!.id, user.id, amount),
      set: () => levelService.setUserXp(interaction.guild!.id, user.id, amount)
    };

    const data = await handlers[subcommand as "add" | "remove" | "set"]();

    if (data.level < previousLevel) {
      const removedRoles = await levelService.removeInvalidLevelRoles(member, data.level);
      await notifyRemovedRoles(member, removedRoles);
    } else {
      await levelService.applyLevelRoles(member, data.level);
      if (interaction.channel?.isTextBased()) {
        await levelService.requestMaxRoleApproval(
          member,
          data.level,
          interaction.channel as GuildTextBasedChannel
        );
      }
    }

    logger.info("MODERATION", "XP_MANUAL_CHANGE", {
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      user: user.tag,
      userId: user.id,
      guild: interaction.guild.name,
      action: subcommand,
      amount,
      reason,
      previousLevel,
      level: data.level,
      xp: data.xp,
      requiredXp: levelService.getRequiredXp(data.level)
    });

    if (data.level > previousLevel) {
      try {
        await member.send(`Parabens! Voce subiu para o nivel ${data.level}.`);
      } catch (error) {
        logger.error("MODERATION", "MANUAL_LEVEL_UP_DM_FAILED", {
          user: user.tag,
          userId: user.id,
          guild: interaction.guild.name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    await interaction.editReply(
      `${user.tag} atualizado. Nivel: ${data.level}, XP: ${data.xp}/${levelService.getRequiredXp(data.level)}.`
    );
  } catch (error) {
    logger.error("MODERATION", "XP_COMMAND_FAILED", {
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await interaction.editReply("Nao consegui alterar o XP agora. Tente novamente em instantes.");
  }
};

async function notifyRemovedRoles(
  member: GuildMember,
  removedRoles: unknown[]
) {
  if (removedRoles.length === 0) {
    return;
  }

  try {
    await member.send(`Voce perdeu o(s) cargo(s) ${removedRoles.join(", ")} por queda nos pontos.`);
  } catch (error) {
    logger.error("MODERATION", "ROLE_LOSS_DM_FAILED", {
      user: member.user.tag,
      userId: member.id,
      guild: member.guild.name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
