import { EmbedBuilder, Guild } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";

interface ParsedLogLine {
  key: string;
  value: string;
}

const divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

export class LogService {
  writeToConsole(title: string, lines: string[]) {
    const timestamp = new Date();
    const type = this.getType(title);
    const parsedLines = this.parseLines(lines);
    const consoleLines = this.formatPrettyLines(type, title, parsedLines, timestamp, true);

    console.log(consoleLines.join("\n"));
  }

  async send(guild: Guild, title: string, lines: string[]) {
    const timestamp = new Date();
    const type = this.getType(title);
    const parsedLines = this.parseLines(lines);
    const consoleLines = this.formatPrettyLines(type, title, parsedLines, timestamp, true);
    const discordLines = this.formatPrettyLines(type, title, parsedLines, timestamp, false);

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
        .setDescription(this.toCodeBlock(discordLines))
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

  private parseLines(lines: string[]): ParsedLogLine[] {
    return lines.map((line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex === -1) {
        return {
          key: "Detalhe",
          value: line
        };
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim() || "-";
      return { key, value };
    });
  }

  private formatPrettyLines(
    type: string,
    title: string,
    lines: ParsedLogLine[],
    timestamp: Date,
    includeSensitiveDetails: boolean
  ) {
    const action = this.getAction(title, lines);
    const header = `${this.getIcon(type)}  ${type} | ${action.toUpperCase()}`;
    const user = this.getValue(lines, ["Usuario", "Usuário", "Autor", "Executor"]);
    const userId = this.getValue(lines, ["ID do usuario", "ID do usuário", "ID do autor"]);
    const channel = this.getValue(lines, ["Canal"]);
    const primaryAction = this.getValue(lines, ["Acao", "Ação"]) ?? action;
    const stateLines = this.getStateLines(lines);
    const detailLines = this.getDetailLines(lines, includeSensitiveDetails);
    const output = [
      divider,
      header,
      divider,
      this.formatRow("🕐", "Data", this.formatDate(timestamp))
    ];

    if (user) {
      output.push(this.formatRow("👤", "Usuário", user));
    }

    if (includeSensitiveDetails && userId) {
      output.push(this.formatRow("🆔", "ID", userId));
    }

    if (channel) {
      output.push(this.formatRow(type === "VOICE" ? "🔊" : "📍", "Canal", channel));
    }

    if (primaryAction) {
      output.push(this.formatRow("🎯", "Ação", primaryAction));
    }

    if (stateLines.length > 0) {
      output.push("", "📋 Estado", ...stateLines);
    }

    if (detailLines.length > 0) {
      output.push("", "📋 Detalhes", ...detailLines);
    }

    output.push(divider);
    return output;
  }

  private getStateLines(lines: ParsedLogLine[]) {
    const stateKeys = ["Microfone", "Audio", "Áudio", "Camera", "Câmera", "Transmissao", "Transmissão"];

    return lines
      .filter((line) => stateKeys.includes(line.key))
      .map((line) => `   ${this.formatStateLabel(line.key)} ${this.formatStateValue(line.key, line.value)}`);
  }

  private getDetailLines(lines: ParsedLogLine[], includeSensitiveDetails: boolean) {
    const reservedKeys = new Set([
      "Usuario",
      "Usuário",
      "Autor",
      "Executor",
      "ID do usuario",
      "ID do usuário",
      "ID do autor",
      "Canal",
      "Acao",
      "Ação",
      "Microfone",
      "Audio",
      "Áudio",
      "Camera",
      "Câmera",
      "Transmissao",
      "Transmissão"
    ]);

    return lines
      .filter((line) => !reservedKeys.has(line.key))
      .filter((line) => includeSensitiveDetails || !this.isIdKey(line.key))
      .map((line) => `   ${line.key.padEnd(18)} ${line.value}`);
  }

  private getValue(lines: ParsedLogLine[], keys: string[]) {
    return lines.find((line) => keys.includes(line.key))?.value;
  }

  private getAction(title: string, lines: ParsedLogLine[]) {
    const action = this.getValue(lines, ["Acao", "Ação"]);

    if (title.includes("Voz") && action) {
      if (action.includes("Entrou")) {
        return "Entrada no canal";
      }

      if (action.includes("Saiu")) {
        return "Saída do canal";
      }

      if (action.includes("Moveu")) {
        return "Mudança de canal";
      }

      if (action.includes("Camera") || action.includes("Câmera")) {
        return "Câmera";
      }

      if (action.includes("Transmissao") || action.includes("Transmissão")) {
        return "Transmissão";
      }
    }

    if (title.includes("Automod")) {
      return "Moderação automática";
    }

    if (title.includes("Mensagem Apagada")) {
      return "Mensagem apagada";
    }

    if (title.includes("Mensagem Editada")) {
      return "Mensagem editada";
    }

    if (title.includes("Level")) {
      return "Level up";
    }

    if (title.includes("XP Manual")) {
      return "XP manual";
    }

    if (title.includes("Cargo")) {
      return "Cargo";
    }

    return title.replace(/^Log de\s+/i, "");
  }

  private formatRow(icon: string, label: string, value: string) {
    return `${icon} ${label.padEnd(11)} ${value}`;
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Fortaleza",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date).replace(",", "");
  }

  private formatStateLabel(label: string) {
    const normalizedLabel = label
      .replace("Audio", "Áudio")
      .replace("Camera", "Câmera")
      .replace("Transmissao", "Transmissão");

    return normalizedLabel.padEnd(11);
  }

  private formatStateValue(key: string, value: string) {
    const enabled = ["Ativado", "Ativada", "iniciada", "sim"].includes(value);

    if (key === "Microfone") {
      return `${enabled ? "🎤" : "🔇"} ${value}`;
    }

    if (key === "Audio" || key === "Áudio") {
      return `${enabled ? "🔊" : "🔈"} ${value}`;
    }

    if (key === "Camera" || key === "Câmera") {
      return `${enabled ? "📷" : "📷"} ${value}`;
    }

    if (key === "Transmissao" || key === "Transmissão") {
      return `${enabled ? "📡" : "📡"} ${value}`;
    }

    return value;
  }

  private getIcon(type: string) {
    const icons: Record<string, string> = {
      MODERATION: "🛡️",
      VOICE: "🎙️",
      XP: "⭐",
      ROLE: "🎖️",
      MESSAGE: "💬",
      SYSTEM: "🧾"
    };

    return icons[type] ?? "🧾";
  }

  private isIdKey(key: string) {
    return key.toLowerCase().includes("id");
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
