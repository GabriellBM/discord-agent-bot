import { REST, Routes } from "discord.js";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { loadCommands } from "./commandLoader";

export async function registerCommands() {
  const commands = await loadCommands();
  const rest = new REST({ version: "10" }).setToken(env.discordToken);
  const payload = commands.map((command) => command.data.toJSON());

  if (env.guildId) {
    await rest.put(Routes.applicationGuildCommands(env.clientId, env.guildId), {
      body: payload
    });
    logger.success("DISCORD", "COMMANDS_REGISTERED", {
      scope: "guild",
      guildId: env.guildId,
      commands: payload.length
    });
    return;
  }

  await rest.put(Routes.applicationCommands(env.clientId), {
    body: payload
  });
  logger.success("DISCORD", "COMMANDS_REGISTERED", {
    scope: "global",
    commands: payload.length
  });
}
