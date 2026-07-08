import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { env } from "./config/env";
import { loadCommands } from "./services/commandLoader";
import { loadEvents } from "./services/eventLoader";
import { registerCommands } from "./services/registerCommands";
import "./types/Command";
import { logger } from "./utils/logger";

async function bootstrap() {
  const startedAt = Date.now();

  logger.info("SYSTEM", "STARTING", {
    service: "discord-agent-bot",
    environment: process.env.NODE_ENV || "development"
  });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
  });

  client.commands = new Collection();
  client.commands = await loadCommands();

  await loadEvents(client);
  await registerCommands();
  await client.login(env.discordToken);

  logger.success("SYSTEM", "READY", {
    startupMs: Date.now() - startedAt
  });
}

bootstrap().catch((error) => {
  logger.error("SYSTEM", "START_FAILED", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});
