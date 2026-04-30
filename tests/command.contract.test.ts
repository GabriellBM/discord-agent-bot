import { describe, expect, it } from "vitest";
import { data as automodData, execute as automodExecute } from "../src/commands/automod";
import { command as askCommand } from "../src/commands/ask";
import { data as banData, execute as banExecute } from "../src/commands/ban";
import { data as cargoData, execute as cargoExecute } from "../src/commands/cargo";
import { data as clearData, execute as clearExecute } from "../src/commands/clear";
import { data as kickData, execute as kickExecute } from "../src/commands/kick";
import { data as leaderboardData, execute as leaderboardExecute } from "../src/commands/leaderboard";
import { data as musicData, execute as musicExecute } from "../src/commands/music";
import { command as pingCommand } from "../src/commands/ping";
import { data as rankData, execute as rankExecute } from "../src/commands/rank";
import { data as serverInfoData, execute as serverInfoExecute } from "../src/commands/serverinfo";
import { data as timeoutData, execute as timeoutExecute } from "../src/commands/timeout";
import { data as userInfoData, execute as userInfoExecute } from "../src/commands/userinfo";
import { data as xpData, execute as xpExecute } from "../src/commands/xp";

const commands = [
  { data: automodData, execute: automodExecute },
  { data: askCommand.data, execute: askCommand.execute, enabled: askCommand.enabled },
  { data: banData, execute: banExecute },
  { data: cargoData, execute: cargoExecute },
  { data: clearData, execute: clearExecute },
  { data: kickData, execute: kickExecute },
  { data: leaderboardData, execute: leaderboardExecute },
  { data: musicData, execute: musicExecute },
  { data: pingCommand.data, execute: pingCommand.execute, enabled: pingCommand.enabled },
  { data: rankData, execute: rankExecute },
  { data: serverInfoData, execute: serverInfoExecute },
  { data: timeoutData, execute: timeoutExecute },
  { data: userInfoData, execute: userInfoExecute },
  { data: xpData, execute: xpExecute }
];

describe("command contracts", () => {
  it("todos os comandos exportam data com nome e execute", () => {
    for (const command of commands) {
      expect(command.data.name).toBeTruthy();
      expect(typeof command.execute).toBe("function");
    }
  });

  it("mantem os nomes publicos esperados dos comandos slash", () => {
    const commandNames = commands.map((command) => command.data.name).sort();

    expect(commandNames).toEqual([
      "applyleigosenior",
      "ask",
      "automod",
      "ban",
      "clear",
      "kick",
      "music",
      "ping",
      "rank",
      "serverinfo",
      "timeout",
      "top10",
      "userinfo",
      "xp"
    ]);
  });

  it("mantem /ask desabilitado para evitar custo acidental", () => {
    expect(askCommand.enabled).toBe(false);
  });

  it("mantem subcomandos esperados do /music", () => {
    const subcommands = musicData.options.map((option) => option.name).sort();

    expect(subcommands).toEqual([
      "leave",
      "loop",
      "nowplaying",
      "pause",
      "play",
      "playlist",
      "resume",
      "skip",
      "stop",
      "volume"
    ]);
  });

  it("mantem subcomandos esperados do /xp", () => {
    const subcommands = xpData.options.map((option) => option.name).sort();

    expect(subcommands).toEqual(["add", "remove", "reset", "set", "sync"]);
  });
});
