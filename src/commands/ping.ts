import { SlashCommandBuilder } from "discord.js";
import { Command } from "../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Responde com a latencia do bot."),
  async execute(interaction) {
    const websocketPing = interaction.client.ws.ping;

    await interaction.reply({
      content: `Latencia: ${websocketPing}ms`,
      ephemeral: true
    });
  }
};
