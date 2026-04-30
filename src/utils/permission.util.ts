import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from "discord.js";

type ModerationAction = "kick" | "ban" | "timeout";

interface ValidateModerationOptions {
  permission: bigint;
  action: ModerationAction;
}

async function sendEphemeralResponse(interaction: ChatInputCommandInteraction, content: string) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content);
    return;
  }

  await interaction.reply({
    content,
    ephemeral: true
  });
}

export async function checkUserPermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint
) {
  if (interaction.memberPermissions?.has(permission)) {
    return true;
  }

  await sendEphemeralResponse(interaction, "🚫 Você não tem permissão para usar este comando.");
  return false;
}

export async function checkBotPermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint
) {
  const botMember = interaction.guild?.members.me;

  if (botMember?.permissions.has(permission)) {
    return true;
  }

  await sendEphemeralResponse(interaction, "🚫 Eu não tenho permissão para executar este comando.");
  return false;
}

export async function checkTargetIsNotOwner(
  interaction: ChatInputCommandInteraction,
  targetMember: GuildMember
) {
  if (targetMember.id !== interaction.guild?.ownerId) {
    return true;
  }

  await sendEphemeralResponse(
    interaction,
    "Não é possível executar essa ação no dono do servidor."
  );
  return false;
}

export async function checkRoleHierarchy(
  interaction: ChatInputCommandInteraction,
  targetMember: GuildMember
) {
  const botMember = interaction.guild?.members.me;

  if (botMember && targetMember.roles.highest.position < botMember.roles.highest.position) {
    return true;
  }

  await sendEphemeralResponse(
    interaction,
    "🚫 Não posso executar essa ação neste usuário por causa da hierarquia de cargos."
  );
  return false;
}

export async function validateModerationAction(
  interaction: ChatInputCommandInteraction,
  targetMember: GuildMember,
  options: ValidateModerationOptions
) {
  if (!(await checkUserPermission(interaction, options.permission))) {
    return false;
  }

  if (!(await checkBotPermission(interaction, options.permission))) {
    return false;
  }

  if (!(await checkTargetIsNotOwner(interaction, targetMember))) {
    return false;
  }

  if (!(await checkRoleHierarchy(interaction, targetMember))) {
    return false;
  }

  if (options.action === "kick" && !targetMember.kickable) {
    await sendEphemeralResponse(interaction, "🚫 Não consigo expulsar esse usuário.");
    return false;
  }

  if (options.action === "ban" && !targetMember.bannable) {
    await sendEphemeralResponse(interaction, "🚫 Não consigo banir esse usuário.");
    return false;
  }

  if (options.action === "timeout" && !targetMember.moderatable) {
    await sendEphemeralResponse(interaction, "🚫 Não consigo aplicar timeout nesse usuário.");
    return false;
  }

  return true;
}

export const moderationPermissions = {
  kick: PermissionFlagsBits.KickMembers,
  ban: PermissionFlagsBits.BanMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  clear: PermissionFlagsBits.ManageMessages
};
