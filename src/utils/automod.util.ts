import { GuildMember } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";

export interface AutomodRule {
  xpPenalty: number;
  timeoutMinutes: number;
  deleteMessage: boolean;
}

export interface ForbiddenWordMatch {
  matched: boolean;
  word?: string;
}

export function isUserImmune(member: GuildMember) {
  if (member.id === member.guild.ownerId) {
    return true;
  }

  if (member.user.bot) {
    return true;
  }

  if (AUTOMOD_CONFIG.ignoredUserIds.includes(member.id)) {
    return true;
  }

  return member.roles.cache.some((role) => AUTOMOD_CONFIG.ignoredRoleIds.includes(role.id));
}

export function getImmunityReason(member: GuildMember) {
  if (member.id === member.guild.ownerId) {
    return "dono do servidor";
  }

  if (member.user.bot) {
    return "bot";
  }

  if (AUTOMOD_CONFIG.ignoredUserIds.includes(member.id)) {
    return "usuário em whitelist";
  }

  const ignoredRole = member.roles.cache.find((role) => AUTOMOD_CONFIG.ignoredRoleIds.includes(role.id));

  if (ignoredRole) {
    return `cargo imune: ${ignoredRole.name}`;
  }

  return null;
}

export function getModerationRuleForMember(member: GuildMember, isSevere: boolean): AutomodRule {
  const baseRule = {
    xpPenalty: isSevere
      ? AUTOMOD_CONFIG.moderation.severeXpPenalty
      : AUTOMOD_CONFIG.moderation.xpPenalty,
    timeoutMinutes: isSevere
      ? AUTOMOD_CONFIG.moderation.severeTimeoutMinutes
      : AUTOMOD_CONFIG.moderation.timeoutMinutes,
    deleteMessage: AUTOMOD_CONFIG.deleteMessage
  };
  const matchingRules = AUTOMOD_CONFIG.roleToleranceRules.filter((rule) => {
    return member.roles.cache.has(rule.roleId);
  });

  if (matchingRules.length === 0) {
    return baseRule;
  }

  const toleranceRule = matchingRules.sort((firstRule, secondRule) => {
    const firstPenalty = isSevere ? firstRule.severeXpPenalty ?? firstRule.xpPenalty : firstRule.xpPenalty;
    const secondPenalty = isSevere ? secondRule.severeXpPenalty ?? secondRule.xpPenalty : secondRule.xpPenalty;

    return firstPenalty - secondPenalty;
  })[0];

  return {
    xpPenalty: isSevere
      ? toleranceRule.severeXpPenalty ?? Math.min(baseRule.xpPenalty, toleranceRule.xpPenalty)
      : Math.min(baseRule.xpPenalty, toleranceRule.xpPenalty),
    timeoutMinutes: isSevere
      ? toleranceRule.severeTimeoutMinutes ?? Math.min(baseRule.timeoutMinutes, toleranceRule.timeoutMinutes)
      : Math.min(baseRule.timeoutMinutes, toleranceRule.timeoutMinutes),
    deleteMessage: toleranceRule.deleteMessage
  };
}

export function findForbiddenWord(content: string): ForbiddenWordMatch {
  const normalizedContent = normalizeText(content);
  const compactContent = compactText(normalizedContent);

  for (const word of AUTOMOD_CONFIG.forbiddenWords) {
    const normalizedWord = normalizeText(word);
    const compactWord = compactText(normalizedWord);

    if (!normalizedWord || !compactWord) {
      continue;
    }

    if (normalizedContent.includes(normalizedWord) || compactContent.includes(compactWord)) {
      return {
        matched: true,
        word
      };
    }
  }

  return { matched: false };
}

function normalizeText(content: string) {
  return content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(content: string) {
  return content.replace(/\s+/g, "");
}
