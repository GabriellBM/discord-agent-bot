import { Client, Events } from "discord.js";
import packageJson from "../../package.json";
import { env } from "../config/env";
import { fetchPublicBotChannel } from "../utils/bot-channel.util";
import { logger } from "../utils/logger";

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

const patchNotes = [
  "logger centralizado com eventos em uma linha para Portainer",
  "logs de voz, musica, IA, moderacao, XP e sistema padronizados",
  "canal de logs removido; observabilidade agora usa stdout do container",
  "imagem Docker dinamica baseada em nome e versao do package.json"
];

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  logger.success("DISCORD", "CONNECTED", {
    bot: client.user.tag,
    guilds: client.guilds.cache.size,
    version: packageJson.version
  });

  await announceBotReady(client);
}

async function announceBotReady(client: Client<true>) {
  if (!env.botInteractionChannelId) {
    logger.info("SYSTEM", "READY_ANNOUNCEMENT_SKIPPED", {
      reason: "BOT_INTERACTION_CHANNEL_ID not configured"
    });
    return;
  }

  const guild = env.guildId
    ? await client.guilds.fetch(env.guildId)
    : client.guilds.cache.first();

  if (!guild) {
    logger.warn("DISCORD", "READY_ANNOUNCEMENT_SKIPPED", {
      reason: "guild not found"
    });
    return;
  }

  const channel = await fetchPublicBotChannel(guild);

  if (!channel) {
    logger.warn("DISCORD", "READY_ANNOUNCEMENT_SKIPPED", {
      reason: "interaction channel not found",
      guild: guild.name
    });
    return;
  }

  const commandLines = publicCommandSummaries
    .filter((command) => client.commands.has(command.name))
    .map((command) => `INFO     [DISCORD]     COMMAND       name="/${command.name}" summary="${command.summary}"`);

  const patchLines = patchNotes.map((note, index) => {
    return `INFO     [SYSTEM]      PATCH_NOTE    version="v${packageJson.version}" item=${index + 1} change="${note}"`;
  });

  const message = [
    "@everyone",
    "",
    "```log",
    `SUCCESS  [SYSTEM]      BOT_ONLINE    service="${packageJson.name}" version="v${packageJson.version}" bot="${client.user.tag}" guild="${guild.name}"`,
    `INFO     [DISCORD]     COMMANDS      channel="${channel.toString()}" available=${commandLines.length}`,
    ...patchLines,
    ...(commandLines.length > 0
      ? commandLines
      : ['WARN     [DISCORD]     COMMANDS      reason="no public commands available"']),
    'INFO     [MODERATION]  XP_SYSTEM     status="enabled" note="ganhe XP conversando; cargos por nivel continuam ativos"',
    'INFO     [MODERATION]  RULES         summary="respeite membros; evite spam, ofensas e conteudo perigoso"',
    "```"
  ].join("\n");

  await channel.send({
    content: message,
    allowedMentions: {
      parse: ["everyone"]
    }
  });
}
