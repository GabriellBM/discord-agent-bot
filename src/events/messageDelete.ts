import { Events, Message, PartialMessage } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";
import { LogService } from "../services/log.service";

const logService = new LogService();

export const name = Events.MessageDelete;
export const once = false;

export async function execute(message: Message | PartialMessage) {
  try {
    if (!message.guild || message.channel.id === AUTOMOD_CONFIG.logChannelId) {
      return;
    }

    await logService.send(message.guild, "Log de Mensagem Apagada", [
      `Autor: ${message.author?.tag ?? "desconhecido"}`,
      `ID do autor: ${message.author?.id ?? "desconhecido"}`,
      `Canal: <#${message.channel.id}>`,
      `Conteudo: ${message.content || "[conteudo indisponivel]"}`
    ]);
  } catch (error) {
    console.error("Erro ao registrar mensagem apagada:", error);
  }
}
