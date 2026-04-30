import OpenAI from "openai";
import { env } from "../config/env";

export class OpenAIService {
  private readonly client: OpenAI;

  constructor() {
    if (!env.openaiApiKey || env.openaiApiKey === "sua_chave_da_openai") {
      throw new Error("OPENAI_API_KEY nao configurada.");
    }

    this.client = new OpenAI({
      apiKey: env.openaiApiKey
    });
  }

  async ask(question: string) {
    const response = await this.client.responses.create({
      model: env.openaiModel,
      instructions:
        "Voce e um assistente util em um bot Discord. Responda em portugues do Brasil, de forma clara e objetiva.",
      input: question,
      max_output_tokens: 700
    });

    const answer = response.output_text?.trim();

    if (!answer) {
      return "Nao consegui gerar uma resposta agora.";
    }

    return answer;
  }
}
