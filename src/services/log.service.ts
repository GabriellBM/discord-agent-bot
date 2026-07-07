import { EmbedBuilder, Guild } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";

export class LogService {
  async send(guild: Guild, title: string, lines: string[]) {
    const timestamp = new Date();
    const type = this.getType(title);
    const consoleLines = this.formatConsoleLines(type, title, lines, timestamp);

    console.log(consoleLines.join("\n"));

    try {
      const channel = await guild.channels.fetch(AUTOMOD_CONFIG.logChannelId);

      if (!channel?.isTextBased() || !("send" in channel)) {
        console.log("Canal de logs nao encontrado ou nao textual.");
        return false;
      }

      const botMember = guild.members.me;
      const permissions = botMember ? channel.permissionsFor(botMember) : null;

      if (!permissions?.has("SendMessages")) {
        console.log(`Bot sem permissao para enviar logs no canal ${AUTOMOD_CONFIG.logChannelId}.`);
        return false;
      }

      const embed = new EmbedBuilder()
        .setTitle(`[${type}] ${title}`)
        .setColor(this.getColor(title))
        .setDescription(this.toCodeBlock(consoleLines))
        .setTimestamp(timestamp)
        .setFooter({ text: `Servidor: ${guild.name} | Registro de aplicacao` });

      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error("Erro ao enviar log:", error);
      return false;
    }
  }

  private truncate(value: string) {
    return value.length > 3800 ? `${value.slice(0, 3796)}...` : value;
  }

  private formatConsoleLines(type: string, title: string, lines: string[], timestamp: Date) {
    const header = `[${timestamp.toISOString()}] [${type}] ${title}`;
    const details = lines.map((line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex === -1) {
        return `  detail=${line}`;
      }

      const key = line.slice(0, separatorIndex).trim().toLowerCase().replaceAll(" ", "_");
      const value = line.slice(separatorIndex + 1).trim() || "-";
      return `  ${key}=${value}`;
    });

    return [header, ...details];
  }

  private toCodeBlock(lines: string[]) {
    const content = this.truncate(lines.join("\n"));
    return `\`\`\`log\n${content}\n\`\`\``;
  }

  private getType(title: string) {
    if (title.includes("Automod")) {
      return "MODERATION";
    }

    if (title.includes("Voz")) {
      return "VOICE";
    }

    if (title.includes("XP") || title.includes("Level")) {
      return "XP";
    }

    if (title.includes("Cargo")) {
      return "ROLE";
    }

    if (title.includes("Mensagem")) {
      return "MESSAGE";
    }

    return "SYSTEM";
  }

  private getColor(title: string) {
    if (title.includes("Automod")) {
      return 0xff5555;
    }

    if (title.includes("Voz")) {
      return 0x5865f2;
    }

    if (title.includes("XP") || title.includes("Level")) {
      return 0x57f287;
    }

    if (title.includes("Mensagem")) {
      return 0xfee75c;
    }

    return 0x2b2d31;
  }
}
