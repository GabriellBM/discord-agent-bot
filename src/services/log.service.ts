import { EmbedBuilder, Guild } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";

export class LogService {
  async send(guild: Guild, title: string, lines: string[]) {
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
        .setTitle(title)
        .setColor(this.getColor(title))
        .setTimestamp(new Date())
        .setFooter({ text: `Servidor: ${guild.name}` });

      const fields = lines.map((line) => {
        const separatorIndex = line.indexOf(":");

        if (separatorIndex === -1) {
          return {
            name: "Detalhe",
            value: this.truncate(line),
            inline: false
          };
        }

        return {
          name: line.slice(0, separatorIndex).trim(),
          value: this.truncate(line.slice(separatorIndex + 1).trim() || "-"),
          inline: false
        };
      });

      embed.addFields(fields);

      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error("Erro ao enviar log:", error);
      return false;
    }
  }

  private truncate(value: string) {
    return value.length > 1024 ? `${value.slice(0, 1020)}...` : value;
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
