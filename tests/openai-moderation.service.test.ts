import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTOMOD_CONFIG } from "../src/config/automod.config";

const moderationCreate = vi.fn();

vi.mock("openai", () => {
  class MockOpenAI {
    moderations = {
      create: moderationCreate
    };
  }

  return {
    default: MockOpenAI
  };
});

async function createService() {
  const module = await import("../src/services/openai-moderation.service");
  return new module.OpenAIModerationService();
}

describe("OpenAIModerationService", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalEnabled = AUTOMOD_CONFIG.moderation.enabled;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    AUTOMOD_CONFIG.moderation.enabled = originalEnabled;
    moderationCreate.mockReset();
  });

  it("nao pune quando moderation esta desativado", async () => {
    AUTOMOD_CONFIG.moderation.enabled = false;
    const service = await createService();

    const result = await service.analyzeMessage("texto qualquer");

    expect(result.enabled).toBe(false);
    expect(result.shouldPunish).toBe(false);
    expect(moderationCreate).not.toHaveBeenCalled();
  });

  it("retorna erro seguro quando API key nao esta configurada", async () => {
    process.env.OPENAI_API_KEY = "";
    const service = await createService();

    const result = await service.analyzeMessage("texto qualquer");

    expect(result.success).toBe(false);
    expect(result.shouldPunish).toBe(false);
    expect(result.error).toContain("OPENAI_API_KEY");
  });

  it("mapeia scores e decide punicao normal", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    moderationCreate.mockResolvedValueOnce({
      results: [
        {
          flagged: false,
          categories: {
            harassment: true
          },
          category_scores: {
            harassment: 0.7,
            violence: 0.1
          }
        }
      ]
    });
    const service = await createService();

    const result = await service.analyzeMessage("texto moderado");

    expect(result.success).toBe(true);
    expect(result.maxScore).toBe(0.7);
    expect(result.detectedCategory).toBe("harassment");
    expect(result.shouldPunish).toBe(true);
    expect(result.isSevere).toBe(false);
  });

  it("marca conteudo severo por categoria sensivel", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    moderationCreate.mockResolvedValueOnce({
      results: [
        {
          flagged: true,
          categories: {
            "violence/graphic": true
          },
          category_scores: {
            "violence/graphic": 0.5
          }
        }
      ]
    });
    const service = await createService();

    const result = await service.analyzeMessage("texto severo");

    expect(result.shouldPunish).toBe(true);
    expect(result.isSevere).toBe(true);
  });

  it("ativa cooldown em erro 429 e evita nova chamada imediata", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const rateLimitError = Object.assign(new Error("429 Too Many Requests"), {
      status: 429,
      headers: {
        get: vi.fn(() => "2")
      }
    });
    moderationCreate.mockRejectedValueOnce(rateLimitError);
    const service = await createService();

    const firstResult = await service.analyzeMessage("primeira mensagem");
    const secondResult = await service.analyzeMessage("segunda mensagem");

    expect(firstResult.rateLimited).toBe(true);
    expect(firstResult.retryAfterMs).toBe(2000);
    expect(secondResult.rateLimited).toBe(true);
    expect(moderationCreate).toHaveBeenCalledTimes(1);
  });
});
