import { SlashCommandBuilder } from "discord.js";
import { OpenAIService } from "../services/openai.service";
import { Command } from "../types/Command";
import { logger } from "../utils/logger";

const maxDiscordMessageLength = 2000;

export const command: Command = {
  enabled: false,
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Faz uma pergunta para a OpenAI.")
    .addStringOption((option) =>
      option
        .setName("pergunta")
        .setDescription("A pergunta que voce quer fazer.")
        .setRequired(true)
    ),
  async execute(interaction) {
    const question = interaction.options.getString("pergunta", true);
    const startedAt = Date.now();

    await interaction.deferReply({ ephemeral: true });

    try {
      const openAIService = new OpenAIService();
      const answer = await openAIService.ask(question);
      const content =
        answer.length > maxDiscordMessageLength
          ? `${answer.slice(0, maxDiscordMessageLength - 20)}\n\n[resposta cortada]`
          : answer;

      logger.info("AI", "RESPONSE", {
        user: interaction.user.tag,
        userId: interaction.user.id,
        model: process.env.OPENAI_MODEL,
        latencyMs: Date.now() - startedAt
      });

      await interaction.editReply(content);
    } catch (error) {
      logger.error("AI", "REQUEST_FAILED", {
        user: interaction.user.tag,
        userId: interaction.user.id,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      await interaction.editReply(
        "Nao consegui consultar a OpenAI agora. Verifique a configuracao da chave e tente novamente em instantes."
      );
    }
  }
};
