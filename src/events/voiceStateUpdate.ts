import { Events, VoiceState } from "discord.js";
import { LogService } from "../services/log.service";
import { musicService } from "../services/music.service";

const logService = new LogService();

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState: VoiceState, newState: VoiceState) {
  try {
    const guild = newState.guild;
    const member = newState.member ?? oldState.member;

    await musicService.handleVoiceStateUpdate(guild.id);

    if (!member) {
      return;
    }

    const changes: string[] = [];

    if (!oldState.channelId && newState.channelId) {
      changes.push(`Entrou no canal de voz: <#${newState.channelId}>`);
    } else if (oldState.channelId && !newState.channelId) {
      changes.push(`Saiu do canal de voz: <#${oldState.channelId}>`);
    } else if (oldState.channelId !== newState.channelId) {
      changes.push(`Moveu de <#${oldState.channelId}> para <#${newState.channelId}>`);
    }

    if (oldState.serverMute !== newState.serverMute) {
      changes.push(`Mute do servidor: ${newState.serverMute ? "ativado" : "desativado"}`);
    }

    if (oldState.serverDeaf !== newState.serverDeaf) {
      changes.push(`Surdez do servidor: ${newState.serverDeaf ? "ativada" : "desativada"}`);
    }

    if (oldState.streaming !== newState.streaming) {
      changes.push(`Transmissao: ${newState.streaming ? "iniciada" : "encerrada"}`);
    }

    if (oldState.selfVideo !== newState.selfVideo) {
      changes.push(`Camera: ${newState.selfVideo ? "ativada" : "desativada"}`);
    }

    if (changes.length === 0) {
      return;
    }

    await logService.send(guild, "Log de Voz", [
      `Usuario: ${member.user.tag}`,
      `ID do usuario: ${member.id}`,
      `Acao: ${changes.join("; ")}`
    ]);
  } catch (error) {
    console.error("Erro ao registrar evento de voz:", error);
  }
}
