import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { env } from "./config/env";
import { loadCommands } from "./services/commandLoader";
import { loadEvents } from "./services/eventLoader";
import { registerCommands } from "./services/registerCommands";
import "./types/Command";

async function bootstrap() {
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
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar o bot:", error);
  process.exit(1);
});
