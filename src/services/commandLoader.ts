import { Collection } from "discord.js";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Command } from "../types/Command";

const requireCommand = createRequire(__filename);

export async function loadCommands(commandsPath = path.join(__dirname, "..", "commands")) {
  const commands = new Collection<string, Command>();
  const commandFiles = await readdir(commandsPath);

  for (const file of commandFiles) {
    if (!file.endsWith(".js") && !file.endsWith(".ts")) {
      continue;
    }

    const filePath = path.join(commandsPath, file);
    const commandModule = requireCommand(filePath);
    const command = (commandModule.command ?? {
      data: commandModule.data,
      enabled: commandModule.enabled,
      execute: commandModule.execute
    }) as Command | undefined;

    if (!command?.data?.name || typeof command.execute !== "function") {
      console.warn(`Comando ignorado por formato invalido: ${file}`);
      continue;
    }

    if (command.enabled === false) {
      console.log(`Comando desabilitado: /${command.data.name}`);
      continue;
    }

    commands.set(command.data.name, command);
  }

  return commands;
}
