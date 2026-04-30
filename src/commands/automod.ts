import { SlashCommandBuilder } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";
import { AutomodService } from "../services/automod.service";
import type { Command } from "../types/Command";

const automodService = new AutomodService();

export const data = new SlashCommandBuilder()
  .setName("automod")
  .setDescription("Gerencia e testa o automod.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("status")
      .setDescription("Mostra o status atual do automod.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("test")
      .setDescription("Testa se um texto cairia no automod pela OpenAI Moderation API.")
      .addStringOption((option) =>
        option
          .setName("texto")
          .setDescription("Texto que será testado.")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("logtest")
      .setDescription("Envia uma mensagem de teste no canal de logs configurado.")
  );

export const execute: Command["execute"] = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!interaction.guild) {
      await interaction.editReply("⚠️ Este comando só pode ser usado em um servidor.");
      return;
    }

    if (interaction.user.id !== interaction.guild.ownerId) {
      await interaction.editReply("🚫 Apenas o dono do servidor pode usar este comando.");
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status") {
      await interaction.editReply(
        [
          "🛡️ Status do Automod",
          `Automod ativo: ${AUTOMOD_CONFIG.enabled ? "sim" : "não"}`,
          `OpenAI Moderation ativo: ${AUTOMOD_CONFIG.moderation.enabled ? "sim" : "não"}`,
          `Modelo: ${AUTOMOD_CONFIG.moderation.model}`,
          `Palavras/frases locais: ${AUTOMOD_CONFIG.forbiddenWords.length}`,
          `Normal threshold: ${AUTOMOD_CONFIG.moderation.normalThreshold}`,
          `Severe threshold: ${AUTOMOD_CONFIG.moderation.severeThreshold}`,
          `Canal de logs: ${AUTOMOD_CONFIG.logChannelId}`,
          `Cargos imunes: ${AUTOMOD_CONFIG.ignoredRoleIds.length}`,
          `Usuários imunes: ${AUTOMOD_CONFIG.ignoredUserIds.length}`,
          `Regras de tolerância por cargo: ${AUTOMOD_CONFIG.roleToleranceRules.length}`
        ].join("\n")
      );
      return;
    }

    if (subcommand === "logtest") {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      await automodService.sendTestLog(interaction.guild, member);
      await interaction.editReply("✅ Teste de log enviado. Se não aparecer, confira o ID do canal e as permissões do bot.");
      return;
    }

    const text = interaction.options.getString("texto", true);
    const preview = await automodService.testContent(text);
    const analysis = preview.analysis;
    const severity = analysis.isSevere ? "severa" : analysis.shouldPunish ? "normal" : "nenhuma";

    await interaction.editReply(
      [
        "🧪 Teste do Automod com OpenAI Moderation API",
        `Lista local: ${preview.localMatch ? `detectou "${preview.localMatch}"` : "não detectou"}`,
        `API ativa: ${analysis.enabled ? "sim" : "não"}`,
        `Sucesso da API: ${analysis.success ? "sim" : "não"}`,
        `Erro da API: ${analysis.error ?? "nenhum"}`,
        `Detectado: ${analysis.shouldPunish ? "sim" : "não"}`,
        `Flagged: ${analysis.flagged ? "sim" : "não"}`,
        `Score máximo: ${analysis.maxScore.toFixed(3)}`,
        `Categoria principal: ${analysis.detectedCategory ?? "nenhuma"}`,
        `Categorias marcadas: ${formatFlaggedCategories(analysis.categories)}`,
        `Scores por categoria: ${formatScores(analysis.categoryScores)}`,
        `Punição: ${severity}`,
        `XP seria removido: ${analysis.shouldPunish ? preview.rule.xpPenalty : 0}`,
        `Timeout seria aplicado: ${analysis.shouldPunish && preview.rule.timeoutMinutes > 0 ? `${preview.rule.timeoutMinutes} minuto(s)` : "não"}`
      ].join("\n")
    );
  } catch (error) {
    console.error("Erro ao executar /automod:", error);
    await interaction.editReply("⚠️ Não consegui consultar o automod agora.");
  }
};

function formatScores(scores: Record<string, number>) {
  const entries = Object.entries(scores);

  if (entries.length === 0) {
    return "nenhum";
  }

  return entries.map(([key, value]) => `${key}: ${value.toFixed(3)}`).join(", ");
}

function formatFlaggedCategories(categories: Record<string, boolean>) {
  const flaggedCategories = Object.entries(categories)
    .filter(([, flagged]) => flagged)
    .map(([category]) => category);

  return flaggedCategories.length > 0 ? flaggedCategories.join(", ") : "nenhuma";
}
