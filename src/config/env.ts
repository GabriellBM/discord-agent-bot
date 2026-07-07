import "dotenv/config";

const requiredVariables = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"] as const;

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${variable}`);
  }
}

export const env = {
  discordToken: process.env.DISCORD_TOKEN as string,
  clientId: process.env.DISCORD_CLIENT_ID as string,
  guildId: process.env.DISCORD_GUILD_ID,
  botInteractionChannelId: process.env.BOT_INTERACTION_CHANNEL_ID,
  levelsFilePath: process.env.LEVELS_FILE_PATH,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
};
