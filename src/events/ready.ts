import { Events, Client } from "discord.js";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  console.log(`Bot conectado como ${client.user.tag}`);
}
