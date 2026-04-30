import { Events, Interaction } from "discord.js";
import { LevelService } from "../services/level.service";
import { musicService } from "../services/music.service";
import { MusicVoteType } from "../types/music.types";

const levelService = new LevelService();

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  if (interaction.isButton()) {
    const [action, guildId, userId] = interaction.customId.split(":");

    if (action === "music_vote_yes" || action === "music_vote_no") {
      await musicService.handleVote(
        interaction,
        userId as MusicVoteType,
        action === "music_vote_yes" ? "yes" : "no"
      );
      return;
    }

    if (action === "approve_max_role" || action === "reject_max_role") {
      await levelService.handleMaxRoleApproval(
        interaction,
        action === "approve_max_role",
        guildId,
        userId
      );
    }

    if (action === "approve_higher_role" || action === "reject_higher_role") {
      await levelService.handleHigherRoleApproval(
        interaction,
        action === "approve_higher_role",
        guildId,
        userId
      );
    }

    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: "❓ Comando não encontrado.",
      ephemeral: true
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar /${interaction.commandName}:`, error);

    const response = {
      content: "⚠️ Ocorreu um erro ao executar este comando.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
      return;
    }

    await interaction.reply(response);
  }
}
