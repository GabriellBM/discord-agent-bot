import { GuildTextBasedChannel, SlashCommandBuilder } from "discord.js";
import { LevelService } from "../services/level.service";
import { LogService } from "../services/log.service";
import type { Command } from "../types/Command";

const levelService = new LevelService();
const logService = new LogService();

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
      await notifyRemovedRoles(interaction, user.toString(), removedRoles);
      await logService.send(interaction.guild, "Log de XP Manual", [
        `Executor: ${interaction.user.tag}`,
        `Usuario: ${user.tag}`,
        `Acao: sync`,
        `Nivel atual: ${data.level}`,
        `Cargos removidos: ${removedRoles.length > 0 ? removedRoles.join(", ") : "nenhum"}`
      ]);
      await interaction.editReply(
        `✅ Cargos de nível sincronizados para ${user.tag}. Nível atual: ${data.level}.`
      );
      return;
    }

    if (subcommand === "reset") {
      const data = await levelService.resetUserLevel(interaction.guild.id, user.id);
      const removedRoles = await levelService.removeInvalidLevelRoles(member, data.level);
      await notifyRemovedRoles(interaction, user.toString(), removedRoles);
      await logService.send(interaction.guild, "Log de XP Manual", [
        `Executor: ${interaction.user.tag}`,
        `Usuario: ${user.tag}`,
        `Acao: reset`,
        `Motivo: ${reason}`,
        `Cargos removidos: ${removedRoles.length > 0 ? removedRoles.join(", ") : "nenhum"}`
      ]);
      console.log(`XP resetado para ${user.tag} por ${interaction.user.tag}. Motivo: ${reason}`);
      await interaction.editReply(
        `✅ ${user.tag} foi resetado. Nível: ${data.level}, XP: ${data.xp}, mensagens: ${data.messages}.`
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
      await notifyRemovedRoles(interaction, user.toString(), removedRoles);
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

    await logService.send(interaction.guild, "Log de XP Manual", [
      `Executor: ${interaction.user.tag}`,
      `Usuario: ${user.tag}`,
      `Acao: ${subcommand}`,
      `Quantidade: ${amount}`,
      `Motivo: ${reason}`,
      `Nivel anterior: ${previousLevel}`,
      `Nivel atual: ${data.level}`,
      `XP atual: ${data.xp}/${levelService.getRequiredXp(data.level)}`
    ]);

    if (data.level > previousLevel && interaction.channel && "send" in interaction.channel) {
      try {
        await interaction.channel.send(
          `🎉 Parabéns, ${user}! Você subiu para o nível ${data.level}.`
        );
      } catch (error) {
        console.error("Nao foi possivel enviar mensagem de level up manual:", error);
      }
    }

    console.log(
      `XP alterado para ${user.tag} por ${interaction.user.tag}. Acao: ${subcommand}. Quantidade: ${amount}. Motivo: ${reason}`
    );
    await interaction.editReply(
      `✅ ${user.tag} atualizado. Nível: ${data.level}, XP: ${data.xp}/${levelService.getRequiredXp(data.level)}.`
    );
  } catch (error) {
    console.error("Erro ao executar /xp:", error);
    await interaction.editReply("⚠️ Não consegui alterar o XP agora. Tente novamente em instantes.");
  }
};

async function notifyRemovedRoles(
  interaction: Parameters<Command["execute"]>[0],
  userMention: string,
  removedRoles: unknown[]
) {
  if (removedRoles.length === 0 || !interaction.channel || !("send" in interaction.channel)) {
    return;
  }

  try {
    await interaction.channel.send(
      `⚠️ ${userMention} perdeu o(s) cargo(s) ${removedRoles.join(", ")} por queda nos pontos.`
    );
  } catch (error) {
    console.error("Nao foi possivel enviar aviso de perda de cargo:", error);
  }
}
