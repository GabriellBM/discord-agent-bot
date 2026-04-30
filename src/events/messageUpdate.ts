import { Events, Message, PartialMessage } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";
import { LogService } from "../services/log.service";

const logService = new LogService();

export const name = Events.MessageUpdate;
export const once = false;

export async function execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
  try {
    if (!newMessage.guild || newMessage.channel.id === AUTOMOD_CONFIG.logChannelId) {
      return;
    }

    if (oldMessage.content === newMessage.content) {
      return;
    }

    await logService.send(newMessage.guild, "Log de Mensagem Editada", [
      `Autor: ${newMessage.author?.tag ?? oldMessage.author?.tag ?? "desconhecido"}`,
      `ID do autor: ${newMessage.author?.id ?? oldMessage.author?.id ?? "desconhecido"}`,
      `Canal: <#${newMessage.channel.id}>`,
      `Antes: ${oldMessage.content || "[conteudo indisponivel]"}`,
      `Depois: ${newMessage.content || "[conteudo indisponivel]"}`
    ]);
  } catch (error) {
    console.error("Erro ao registrar mensagem editada:", error);
  }
}
