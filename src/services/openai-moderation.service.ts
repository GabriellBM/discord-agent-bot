import OpenAI from "openai";
import { AUTOMOD_CONFIG } from "../config/automod.config";

export interface OpenAIModerationResult {
  enabled: boolean;
  success: boolean;
  flagged: boolean;
  maxScore: number;
  detectedCategory?: string;
  isSevere: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  shouldPunish: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number;
  error?: string;
}

const severeCategories = [
  "violence",
  "violence/graphic",
  "hate/threatening",
  "harassment/threatening",
  "self-harm/intent",
  "self-harm/instructions",
  "sexual/minors"
];

export class OpenAIModerationService {
  private openai?: OpenAI;
  private rateLimitedUntil = 0;

  constructor() {}

  async analyzeMessage(text: string): Promise<OpenAIModerationResult> {
    if (!AUTOMOD_CONFIG.moderation.enabled) {
      return this.emptyResult({ enabled: false, success: true });
    }

    const trimmedText = text.trim();

    if (trimmedText.length < AUTOMOD_CONFIG.moderation.minTextLength) {
      return this.emptyResult({ enabled: true, success: true });
    }

    if (Date.now() < this.rateLimitedUntil) {
      return this.emptyResult({
        enabled: true,
        success: false,
        rateLimited: true,
        retryAfterMs: this.rateLimitedUntil - Date.now(),
        error: "OpenAI Moderation API temporariamente em cooldown por limite de requisições."
      });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "COLOQUE_AQUI_SUA_CHAVE") {
      return this.emptyResult({
        enabled: true,
        success: false,
        error: "OPENAI_API_KEY não configurada."
      });
    }

    try {
      const response = await this.getClient().moderations.create({
        model: AUTOMOD_CONFIG.moderation.model,
        input: trimmedText
      });
      const result = response.results[0];

      if (!result) {
        return this.emptyResult({
          enabled: true,
          success: false,
          error: "A OpenAI Moderation API não retornou resultado."
        });
      }

      const categories = result.categories as unknown as Record<string, boolean>;
      const categoryScores = result.category_scores as unknown as Record<string, number>;
      let maxScore = 0;
      let detectedCategory: string | undefined;

      for (const category of AUTOMOD_CONFIG.moderation.categories) {
        const score = categoryScores[category];

        if (typeof score === "number" && score > maxScore) {
          maxScore = score;
          detectedCategory = category;
        }
      }

      const isSevere =
        maxScore >= AUTOMOD_CONFIG.moderation.severeThreshold ||
        severeCategories.some((category) => categories[category] === true);

      return {
        enabled: true,
        success: true,
        flagged: result.flagged,
        maxScore,
        detectedCategory,
        isSevere,
        categories,
        categoryScores,
        shouldPunish: result.flagged === true || maxScore >= AUTOMOD_CONFIG.moderation.normalThreshold
      };
    } catch (error) {
      if (this.isRateLimitError(error)) {
        const retryAfterMs = this.getRetryAfterMs(error);
        this.rateLimitedUntil = Date.now() + retryAfterMs;

        return this.emptyResult({
          enabled: true,
          success: false,
          rateLimited: true,
          retryAfterMs,
          error: `OpenAI Moderation API atingiu limite de requisições. Nova tentativa em ${Math.ceil(retryAfterMs / 1000)}s.`
        });
      }

      return this.emptyResult({
        enabled: true,
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido na OpenAI Moderation API."
      });
    }
  }

  private emptyResult(options: {
    enabled: boolean;
    success: boolean;
    rateLimited?: boolean;
    retryAfterMs?: number;
    error?: string;
  }): OpenAIModerationResult {
    return {
      enabled: options.enabled,
      success: options.success,
      flagged: false,
      maxScore: 0,
      isSevere: false,
      categories: {},
      categoryScores: {},
      shouldPunish: false,
      rateLimited: options.rateLimited,
      retryAfterMs: options.retryAfterMs,
      error: options.error
    };
  }

  private isRateLimitError(error: unknown) {
    return typeof error === "object" && error !== null && "status" in error && error.status === 429;
  }

  private getRetryAfterMs(error: unknown) {
    if (typeof error === "object" && error !== null && "headers" in error) {
      const headers = error.headers as { get?: (name: string) => string | null };
      const retryAfter = headers.get?.("retry-after");
      const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;

      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
      }
    }

    return AUTOMOD_CONFIG.moderation.rateLimitCooldownMs;
  }

  private getClient() {
    this.openai ??= new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    return this.openai;
  }
}
