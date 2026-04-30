import { Events, Message } from "discord.js";
import { AUTOMOD_CONFIG } from "../config/automod.config";
import { AutomodService } from "../services/automod.service";
import { LevelService } from "../services/level.service";
import { LogService } from "../services/log.service";

const automodService = new AutomodService();
const levelService = new LevelService();
const logService = new LogService();

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  try {
    if (message.author.bot || !message.inGuild()) {
      return;
    }

    const member = message.member ?? (await message.guild.members.fetch(message.author.id));

    if (message.channel.id !== AUTOMOD_CONFIG.logChannelId) {
      await logService.send(message.guild, "Log de Mensagem", [
        `Autor: ${message.author.tag}`,
        `ID do autor: ${message.author.id}`,
        `Canal: <#${message.channel.id}>`,
        `Conteudo: ${message.content || "[sem conteudo textual]"}`
      ]);
    }

    const handledByAutomod = await automodService.handleMessage(message);

    if (handledByAutomod) {
      return;
    }

    const result = await levelService.addMessageXp(message.guild.id, message.author.id);

    if (!result.onCooldown) {
      await levelService.applyLevelRoles(member, result.data.level);
      await logService.send(message.guild, "Log de XP", [
        `Usuario: ${message.author.tag}`,
        `ID do usuario: ${message.author.id}`,
        `Canal: <#${message.channel.id}>`,
        `Acao: ganhou XP por mensagem`,
        `XP ganho: ${result.gainedXp}`,
        `Nivel atual: ${result.data.level}`,
        `XP atual: ${result.data.xp}/${levelService.getRequiredXp(result.data.level)}`
      ]);
    }

    if (!result.leveledUp) {
      return;
    }

    if ("send" in message.channel) {
      try {
        await message.channel.send(
          `🎉 Parabéns, ${message.author}! Você subiu para o nível ${result.data.level}.`
        );
      } catch (error) {
        console.error("Nao foi possivel enviar mensagem de level up:", error);
      }
    } else {
      console.log("Nao foi possivel enviar level up: canal sem suporte a envio de mensagem.");
    }

    await logService.send(message.guild, "Log de Level Up", [
      `Usuario: ${message.author.tag}`,
      `ID do usuario: ${message.author.id}`,
      `Canal: <#${message.channel.id}>`,
      `Novo nivel: ${result.data.level}`
    ]);

    if (message.channel.isTextBased()) {
      await levelService.requestMaxRoleApproval(member, result.data.level, message.channel);
    }
  } catch (error) {
    console.error("Erro ao processar XP da mensagem:", error);
  }
}
