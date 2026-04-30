import { REST, Routes } from "discord.js";
import { env } from "../config/env";
import { loadCommands } from "./commandLoader";

export async function registerCommands() {
  const commands = await loadCommands();
  const rest = new REST({ version: "10" }).setToken(env.discordToken);
  const payload = commands.map((command) => command.data.toJSON());

  if (env.guildId) {
    await rest.put(Routes.applicationGuildCommands(env.clientId, env.guildId), {
      body: payload
    });
    console.log(`${payload.length} comando(s) registrado(s) no servidor ${env.guildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(env.clientId), {
    body: payload
  });
  console.log(`${payload.length} comando(s) global(is) registrado(s).`);
}
