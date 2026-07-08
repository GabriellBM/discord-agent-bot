import { Guild } from "discord.js";
import { logger, LogContext, LogMetadata } from "../utils/logger";

export class LogService {
  writeToConsole(title: string, lines: string[]) {
    logger.info(this.getContext(title), this.getEvent(title), this.toMetadata(lines));
  }

  async send(guild: Guild, title: string, lines: string[]) {
    logger.info(this.getContext(title), this.getEvent(title), {
      guild: guild.name,
      ...this.toMetadata(lines)
    });

    return true;
  }

  private toMetadata(lines: string[]): LogMetadata {
    return Object.fromEntries(
      lines.map((line) => {
        const separatorIndex = line.indexOf(":");

        if (separatorIndex === -1) {
          return ["detail", line];
        }

        const key = this.normalizeKey(line.slice(0, separatorIndex).trim());
        const value = line.slice(separatorIndex + 1).trim();

        return [key, value || undefined];
      })
    );
  }

  private normalizeKey(key: string) {
    return key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase())
      .replace(/^[A-Z]/, (character) => character.toLowerCase()) || "detail";
  }

  private getContext(title: string): LogContext {
    if (title.includes("Automod") || title.includes("XP") || title.includes("Level") || title.includes("Cargo")) {
      return "MODERATION";
    }

    if (title.includes("Voz")) {
      return "VOICE";
    }

    if (title.includes("Mensagem")) {
      return "DISCORD";
    }

    return "SYSTEM";
  }

  private getEvent(title: string) {
    return title
      .replace(/^Log de\s+/i, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
}
