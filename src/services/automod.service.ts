import {
  Guild,
  GuildMember,
  Message,
  PermissionFlagsBits
} from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";
import { AutomodRule, findForbiddenWord, getModerationRuleForMember, isUserImmune } from "../utils/automod.util";
import { fetchPublicBotChannel } from "../utils/bot-channel.util";
import { logger } from "../utils/logger";
import { LevelService } from "./level.service";
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

      logger.error("AI", "MODERATION_FAILED", {
        user: message.author.tag,
        userId: message.author.id,
        channelId: message.channel.id,
        guild: message.guild.name,
        error: analysis.error
      });
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
        logger.error("MODERATION", "MESSAGE_DELETE_FAILED", {
          user: message.author.tag,
          userId: message.author.id,
          channelId: message.channel.id,
          guild: message.guild.name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    const updatedLevelData = await this.levelService.applyXpPenalty(member, rule.xpPenalty);

    if (updatedLevelData) {
      const removedRoles = await this.levelService.removeInvalidLevelRoles(member, updatedLevelData.level);
      rolesRemoved = removedRoles.length > 0;

      const publicBotChannel = await fetchPublicBotChannel(message.guild, message.channel.id);

      if (rolesRemoved && publicBotChannel) {
        await publicBotChannel.send(
          `${member}, voce perdeu o(s) cargo(s) ${removedRoles.join(", ")} por queda nos pontos.`
        );
      }
    }

    if (rule.timeoutMinutes > 0) {
      timeoutApplied = await this.applyTimeout(member, rule.timeoutMinutes);
    }

    const publicBotChannel = await fetchPublicBotChannel(message.guild, message.channel.id);

    if (publicBotChannel) {
      const publicMessage = analysis.isSevere
        ? `${member}, sua mensagem foi detectada como violacao grave das regras. Voce perdeu ${rule.xpPenalty} XP.`
        : `${member}, sua mensagem violou as regras. Voce perdeu ${rule.xpPenalty} XP.`;

      await publicBotChannel.send(publicMessage);
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
    logger.warn("MODERATION", "AUTOMOD_ACTION", {
      source: payload.localMatch ? "local list + automod" : "OpenAI Moderation API",
      user: payload.member.user.tag,
      userId: payload.member.id,
      channelId: payload.channelId,
      guild: guild.name,
      reason: payload.localMatch ?? payload.analysis.detectedCategory ?? "automatic moderation",
      severity: payload.analysis.isSevere ? "severe" : "normal",
      messageDeleted: payload.messageDeleted,
      xpRemoved: payload.xpRemoved,
      timeoutApplied: payload.timeoutApplied,
      rolesRemoved: payload.rolesRemoved,
      content: payload.messageContent,
      error: payload.analysis.error
    });
  }

  async sendTestLog(guild: Guild, member: GuildMember) {
    logger.info("MODERATION", "LOG_TEST", {
      user: member.user.tag,
      userId: member.id,
      guild: guild.name,
      source: "stdout"
    });
  }

  private async applyTimeout(member: GuildMember, timeoutMinutes: number) {
    try {
      const botMember = member.guild.members.me;

      if (!botMember?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        logger.warn("MODERATION", "TIMEOUT_SKIPPED", {
          user: member.user.tag,
          userId: member.id,
          guild: member.guild.name,
          reason: "missing ModerateMembers permission"
        });
        return false;
      }

      if (!member.moderatable) {
        logger.warn("MODERATION", "TIMEOUT_SKIPPED", {
          user: member.user.tag,
          userId: member.id,
          guild: member.guild.name,
          reason: "member not moderatable"
        });
        return false;
      }

      await member.timeout(timeoutMinutes * 60 * 1000, "Automod: OpenAI Moderation API");
      return true;
    } catch (error) {
      logger.error("MODERATION", "TIMEOUT_FAILED", {
        user: member.user.tag,
        userId: member.id,
        guild: member.guild.name,
        timeoutMinutes,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  private logRateLimitOnce(analysis: OpenAIModerationResult) {
    const now = Date.now();

    if (now - this.lastRateLimitLogAt < 30_000) {
      return;
    }

    this.lastRateLimitLogAt = now;
    logger.warn("AI", "RATE_LIMITED", {
      service: "OpenAI Moderation API",
      retryAfterSeconds: Math.ceil((analysis.retryAfterMs ?? 0) / 1000)
    });
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
