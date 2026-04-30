import {
  Guild,
  GuildMember,
  Message,
  PermissionFlagsBits
} from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";
import { AutomodRule, findForbiddenWord, getModerationRuleForMember, isUserImmune } from "../utils/automod.util";
import { LevelService } from "./level.service";
import { LogService } from "./log.service";
import { OpenAIModerationResult, OpenAIModerationService } from "./openai-moderation.service";

interface AutomodLogPayload {
  member: GuildMember;
  channelId: string;
  messageContent: string;
  analysis: OpenAIModerationResult;
  rule?: AutomodRule;
  messageDeleted: boolean;
  xpRemoved: number;
  timeoutApplied: boolean;
  rolesRemoved: boolean;
  localMatch?: string;
}

export class AutomodService {
  private readonly logService = new LogService();
  private readonly moderationService = new OpenAIModerationService();
  private lastRateLimitLogAt = 0;

  constructor(private readonly levelService = new LevelService()) {}

  async testContent(content: string) {
    const localMatch = findForbiddenWord(content);

    if (localMatch.matched) {
      const analysis = this.createLocalModerationResult(localMatch.word);

      return {
        analysis,
        rule: getDefaultRule(false),
        localMatch: localMatch.word
      };
    }

    const analysis = await this.moderationService.analyzeMessage(content);

    return {
      analysis,
      rule: getDefaultRule(analysis.isSevere),
      localMatch: undefined
    };
  }

  async handleMessage(message: Message<true>) {
    if (!AUTOMOD_CONFIG.enabled) {
      return false;
    }

    const member = message.member ?? (await message.guild.members.fetch(message.author.id));

    if (isUserImmune(member)) {
      return false;
    }

    const localMatch = findForbiddenWord(message.content);
    const analysis = localMatch.matched
      ? this.createLocalModerationResult(localMatch.word)
      : await this.moderationService.analyzeMessage(message.content);

    if (!analysis.success) {
      if (analysis.rateLimited) {
        this.logRateLimitOnce(analysis);
        return false;
      }

      console.error("OpenAI Moderation API falhou:", analysis.error);
      await this.sendAutomodLog(message.guild, {
        member,
        channelId: message.channel.id,
        messageContent: message.content,
        analysis,
        messageDeleted: false,
        xpRemoved: 0,
        timeoutApplied: false,
        rolesRemoved: false,
        localMatch: localMatch.word
      });
      return false;
    }

    if (!analysis.enabled || !analysis.shouldPunish) {
      return false;
    }

    const rule = getModerationRuleForMember(member, analysis.isSevere);
    let messageDeleted = false;
    let timeoutApplied = false;
    let rolesRemoved = false;

    if (rule.deleteMessage && message.deletable) {
      try {
        await message.delete();
        messageDeleted = true;
      } catch (error) {
        console.error("Automod não conseguiu deletar mensagem:", error);
      }
    }

    const updatedLevelData = await this.levelService.applyXpPenalty(member, rule.xpPenalty);

    if (updatedLevelData) {
      const removedRoles = await this.levelService.removeInvalidLevelRoles(member, updatedLevelData.level);
      rolesRemoved = removedRoles.length > 0;

      if (rolesRemoved && "send" in message.channel) {
        await message.channel.send(
          `⚠️ ${member}, você perdeu o(s) cargo(s) ${removedRoles.join(", ")} por queda nos pontos.`
        );
      }
    }

    if (rule.timeoutMinutes > 0) {
      timeoutApplied = await this.applyTimeout(member, rule.timeoutMinutes);
    }

    if ("send" in message.channel) {
      const publicMessage = analysis.isSevere
        ? `🚨 ${member}, sua mensagem foi detectada como violação grave das regras. Você perdeu ${rule.xpPenalty} XP.`
        : `⚠️ ${member}, sua mensagem violou as regras. Você perdeu ${rule.xpPenalty} XP.`;

      await message.channel.send(publicMessage);
    }

    await this.sendAutomodLog(message.guild, {
      member,
      channelId: message.channel.id,
      messageContent: message.content,
      analysis,
      rule,
      messageDeleted,
      xpRemoved: rule.xpPenalty,
      timeoutApplied,
      rolesRemoved,
      localMatch: localMatch.word
    });

    return true;
  }

  async sendAutomodLog(guild: Guild, payload: AutomodLogPayload) {
    await this.logService.send(guild, "🛡️ Log de Automod", [
      `Origem: ${payload.localMatch ? "lista local + automod" : "OpenAI Moderation API"}`,
      `Lista local: ${payload.localMatch ? `sim (${payload.localMatch})` : "não"}`,
      `Usuário: ${payload.member.user.tag}`,
      `ID do usuário: ${payload.member.id}`,
      `Canal: <#${payload.channelId}>`,
      `Mensagem original: ${payload.messageContent}`,
      `Sucesso da API: ${payload.analysis.success ? "sim" : "não"}`,
      `Erro da API: ${payload.analysis.error ?? "nenhum"}`,
      `Flagged: ${payload.analysis.flagged ? "sim" : "não"}`,
      `Score máximo: ${formatScore(payload.analysis.maxScore)}`,
      `Categoria principal: ${payload.analysis.detectedCategory ?? "nenhuma"}`,
      `Categorias marcadas: ${formatFlaggedCategories(payload.analysis.categories)}`,
      `Scores por categoria: ${formatScores(payload.analysis.categoryScores)}`,
      `Severo: ${payload.analysis.isSevere ? "sim" : "não"}`,
      `Mensagem deletada: ${payload.messageDeleted ? "sim" : "não"}`,
      `XP removido: ${payload.xpRemoved}`,
      `Timeout aplicado: ${payload.timeoutApplied ? "sim" : "não"}`,
      `Cargos removidos: ${payload.rolesRemoved ? "sim" : "não"}`
    ]);
  }

  async sendTestLog(guild: Guild, member: GuildMember) {
    await this.sendAutomodLog(guild, {
      member,
      channelId: AUTOMOD_CONFIG.logChannelId,
      messageContent: "Mensagem de teste do automod",
      analysis: {
        enabled: true,
        success: true,
        flagged: false,
        maxScore: 0,
        isSevere: false,
        categories: {},
        categoryScores: {},
        shouldPunish: false
      },
      messageDeleted: false,
      xpRemoved: 0,
      timeoutApplied: false,
      rolesRemoved: false
    });
  }

  private async applyTimeout(member: GuildMember, timeoutMinutes: number) {
    try {
      const botMember = member.guild.members.me;

      if (!botMember?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        console.log("Automod não aplicou timeout: bot sem ModerateMembers.");
        return false;
      }

      if (!member.moderatable) {
        console.log(`Automod não conseguiu aplicar timeout em ${member.user.tag}.`);
        return false;
      }

      await member.timeout(timeoutMinutes * 60 * 1000, "Automod: OpenAI Moderation API");
      return true;
    } catch (error) {
      console.error("Erro ao aplicar timeout do automod:", error);
      return false;
    }
  }

  private logRateLimitOnce(analysis: OpenAIModerationResult) {
    const now = Date.now();

    if (now - this.lastRateLimitLogAt < 30_000) {
      return;
    }

    this.lastRateLimitLogAt = now;
    console.warn(
      `OpenAI Moderation API em cooldown por limite de requisições. Tentando novamente em ${Math.ceil((analysis.retryAfterMs ?? 0) / 1000)}s.`
    );
  }
  private createLocalModerationResult(word?: string): OpenAIModerationResult {
    return {
      enabled: true,
      success: true,
      flagged: true,
      maxScore: 1,
      detectedCategory: word ? `lista local: ${word}` : "lista local",
      isSevere: false,
      categories: {
        local: true
      },
      categoryScores: {
        local: 1
      },
      shouldPunish: true
    };
  }
}

function getDefaultRule(isSevere: boolean): AutomodRule {
  return {
    xpPenalty: isSevere
      ? AUTOMOD_CONFIG.moderation.severeXpPenalty
      : AUTOMOD_CONFIG.moderation.xpPenalty,
    timeoutMinutes: isSevere
      ? AUTOMOD_CONFIG.moderation.severeTimeoutMinutes
      : AUTOMOD_CONFIG.moderation.timeoutMinutes,
    deleteMessage: AUTOMOD_CONFIG.deleteMessage
  };
}

function formatScore(score: number) {
  return score.toFixed(3);
}

function formatScores(scores: Record<string, number>) {
  const entries = Object.entries(scores);

  if (entries.length === 0) {
    return "nenhum";
  }

  return entries.map(([key, value]) => `${key}: ${formatScore(value)}`).join(", ");
}

function formatFlaggedCategories(categories: Record<string, boolean>) {
  const flaggedCategories = Object.entries(categories)
    .filter(([, flagged]) => flagged)
    .map(([category]) => category);

  return flaggedCategories.length > 0 ? flaggedCategories.join(", ") : "nenhuma";
}
