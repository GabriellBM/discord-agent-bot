import { Client, Events } from "discord.js";
import packageJson from "../../package.json";
import { env } from "../config/env";
import { fetchPublicBotChannel } from "../utils/bot-channel.util";

const publicCommandSummaries = [
  {
    name: "ping",
    summary: "confere se eu estou respondendo e mostra minha latencia."
  },
  {
    name: "rank",
    summary: "mostra seu nivel, XP e progresso no servidor."
  },
  {
    name: "top10",
    summary: "mostra o ranking dos membros com mais nivel e XP."
  },
  {
    name: "userinfo",
    summary: "mostra informacoes basicas de um membro."
  },
  {
    name: "serverinfo",
    summary: "mostra informacoes gerais do servidor."
  },
  {
    name: "music",
    summary: "toca musicas, mostra a playlist e permite controlar a fila."
  },
  {
    name: "applyleigosenior",
    summary: "solicita o cargo superior quando voce ja tem o cargo MAX."
  }
];

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  console.log(`Bot conectado como ${client.user.tag}`);

  await announceBotReady(client);
}

async function announceBotReady(client: Client<true>) {
  if (!env.botInteractionChannelId) {
    console.log("Anuncio de inicializacao ignorado: BOT_INTERACTION_CHANNEL_ID nao configurado.");
    return;
  }

  const guild = env.guildId
    ? await client.guilds.fetch(env.guildId)
    : client.guilds.cache.first();

  if (!guild) {
    console.log("Anuncio de inicializacao ignorado: nenhum servidor encontrado.");
    return;
  }

  const channel = await fetchPublicBotChannel(guild);

  if (!channel) {
    console.log("Anuncio de inicializacao ignorado: canal de interacao nao encontrado.");
    return;
  }

  const commandLines = publicCommandSummaries
    .filter((command) => client.commands.has(command.name))
    .map((command) => `/${command.name} - ${command.summary}`);

  const message = [
    "@everyone",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `BOT ONLINE | v${packageJson.version}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "Oi! Estou online e pronto para atender por aqui.",
    "Use este canal para comandos do bot sem espalhar mensagens pelo servidor.",
    "",
    "COMANDOS PUBLICOS",
    commandLines.join("\n") || "Nenhum comando publico disponivel no momento.",
    "",
    "SISTEMA DE XP",
    "- Ganhe XP participando das conversas do servidor.",
    "- Ao acumular XP suficiente, voce sobe de nivel.",
    "- Cargos de nivel podem ser liberados automaticamente.",
    "- Cargos especiais precisam de aprovacao do owner no privado.",
    "",
    "REGRAS DO SERVIDOR",
    "- Respeite os outros membros.",
    "- Evite ofensas, assedio, preconceito e provocacoes.",
    "- Nao envie spam, flood ou conteudo perigoso.",
    "- Use este canal para comandos do bot.",
    "- Violacoes podem causar perda de XP e moderacao automatica.",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ].join("\n");

  await channel.send({
    content: message,
    allowedMentions: {
      parse: ["everyone"]
    }
  });
}
