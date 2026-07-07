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

    const consoleChanges: string[] = [];
    const discordChanges: string[] = [];
    const channel = newState.channel ?? oldState.channel;
    const stateForDisplay = newState.channelId ? newState : oldState;

    if (!oldState.channelId && newState.channelId) {
      consoleChanges.push("Entrou no canal de voz");
      discordChanges.push("Entrou no canal de voz");
    } else if (oldState.channelId && !newState.channelId) {
      consoleChanges.push("Saiu do canal de voz");
      discordChanges.push("Saiu do canal de voz");
    } else if (oldState.channelId !== newState.channelId) {
      const moveAction = `Moveu de ${oldState.channel?.name ?? "canal desconhecido"} para ${newState.channel?.name ?? "canal desconhecido"}`;
      consoleChanges.push(moveAction);
      discordChanges.push(moveAction);
    }

    if (oldState.serverMute !== newState.serverMute) {
      const serverMuteAction = `Mute do servidor: ${newState.serverMute ? "ativado" : "desativado"}`;
      consoleChanges.push(serverMuteAction);
      discordChanges.push(serverMuteAction);
    }

    if (oldState.serverDeaf !== newState.serverDeaf) {
      const serverDeafAction = `Surdez do servidor: ${newState.serverDeaf ? "ativada" : "desativada"}`;
      consoleChanges.push(serverDeafAction);
      discordChanges.push(serverDeafAction);
    }

    if (oldState.selfMute !== newState.selfMute) {
      consoleChanges.push(`Auto mute: ${newState.selfMute ? "ativado" : "desativado"}`);
    }

    if (oldState.selfDeaf !== newState.selfDeaf) {
      consoleChanges.push(`Auto surdez: ${newState.selfDeaf ? "ativada" : "desativada"}`);
    }

    if (oldState.streaming !== newState.streaming) {
      const streamingAction = `Transmissao: ${newState.streaming ? "iniciada" : "encerrada"}`;
      consoleChanges.push(streamingAction);
      discordChanges.push(streamingAction);
    }

    if (oldState.selfVideo !== newState.selfVideo) {
      const videoAction = `Camera: ${newState.selfVideo ? "ativada" : "desativada"}`;
      consoleChanges.push(videoAction);
      discordChanges.push(videoAction);
    }

    if (consoleChanges.length === 0) {
      return;
    }

    const logLines = [
      `Usuario: ${member.displayName}`,
      `ID do usuario: ${member.id}`,
      `Canal: ${channel?.name ?? "canal desconhecido"}`,
      `Acao: ${consoleChanges.join("; ")}`,
      `Microfone: ${stateForDisplay.selfMute ? "Desativado" : "Ativado"}`,
      `Audio: ${stateForDisplay.selfDeaf ? "Desativado" : "Ativado"}`,
      `Camera: ${stateForDisplay.selfVideo ? "Ativada" : "Desativada"}`,
      `Transmissao: ${stateForDisplay.streaming ? "Ativada" : "Desativada"}`
    ];

    logService.writeToConsole("Log de Voz", logLines);

    if (discordChanges.length === 0) {
      return;
    }

    await logService.send(guild, "Log de Voz", [
      `Usuario: ${member.displayName}`,
      `ID do usuario: ${member.id}`,
      `Canal: ${channel?.name ?? "canal desconhecido"}`,
      `Acao: ${discordChanges.join("; ")}`,
      `Microfone: ${stateForDisplay.selfMute ? "Desativado" : "Ativado"}`,
      `Audio: ${stateForDisplay.selfDeaf ? "Desativado" : "Ativado"}`,
      `Camera: ${stateForDisplay.selfVideo ? "Ativada" : "Desativada"}`,
      `Transmissao: ${stateForDisplay.streaming ? "Ativada" : "Desativada"}`
    ]);
  } catch (error) {
    console.error("Erro ao registrar evento de voz:", error);
  }
}
