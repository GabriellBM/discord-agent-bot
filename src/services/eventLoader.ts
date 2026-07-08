import { Client } from "discord.js";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { logger } from "../utils/logger";

const requireEvent = createRequire(__filename);

interface EventModule {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void> | void;
}

export async function loadEvents(client: Client, eventsPath = path.join(__dirname, "..", "events")) {
  const eventFiles = await readdir(eventsPath);

  for (const file of eventFiles) {
    if (!file.endsWith(".js") && !file.endsWith(".ts")) {
      continue;
    }

    const filePath = path.join(eventsPath, file);
    const event = requireEvent(filePath) as EventModule;

    if (!event.name || typeof event.execute !== "function") {
      logger.warn("SYSTEM", "EVENT_SKIPPED", {
        file,
        reason: "invalid format"
      });
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
      continue;
    }

    client.on(event.name, (...args) => event.execute(...args));
  }
}
