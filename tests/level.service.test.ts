import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LevelService } from "../src/services/level.service";

let tempDir: string;
let databasePath: string;
let service: LevelService;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "discord-bot-levels-"));
  databasePath = path.join(tempDir, "levels.json");
  service = new LevelService(databasePath);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function readDatabase() {
  return JSON.parse(await readFile(databasePath, "utf-8")) as Record<string, Record<string, unknown>>;
}

describe("LevelService", () => {
  it("cria usuario com nivel inicial ao consultar banco vazio", async () => {
    const user = await service.getUser("guild-id", "user-id");

    expect(user).toEqual({
      xp: 0,
      level: 1,
      messages: 0,
      lastXpAt: 0
    });
  });

  it("calcula XP necessario por nivel", () => {
    expect(service.getRequiredXp(1)).toBe(100);
    expect(service.getRequiredXp(20)).toBe(2000);
    expect(service.getRequiredXp(50)).toBe(5000);
  });

  it("sobe niveis ao adicionar XP suficiente", async () => {
    const user = await service.addUserXp("guild-id", "user-id", 350);

    expect(user.level).toBe(3);
    expect(user.xp).toBe(50);
  });

  it("desce de nivel ao remover XP abaixo de zero", async () => {
    await service.addUserXp("guild-id", "user-id", 350);

    const user = await service.removeUserXp("guild-id", "user-id", 100);

    expect(user.level).toBe(2);
    expect(user.xp).toBe(150);
  });

  it("nao deixa XP negativo no nivel 1", async () => {
    const user = await service.removeUserXp("guild-id", "user-id", 999);

    expect(user.level).toBe(1);
    expect(user.xp).toBe(0);
  });

  it("define XP e normaliza nivel", async () => {
    const user = await service.setUserXp("guild-id", "user-id", 300);

    expect(user.level).toBe(3);
    expect(user.xp).toBe(0);
  });

  it("reseta dados do usuario", async () => {
    await service.addUserXp("guild-id", "user-id", 500);

    const user = await service.resetUserLevel("guild-id", "user-id");

    expect(user).toEqual({
      xp: 0,
      level: 1,
      messages: 0,
      lastXpAt: 0
    });
  });

  it("salva alteracoes no banco configurado", async () => {
    await service.addUserXp("guild-id", "user-id", 100);

    const database = await readDatabase();

    expect(database["guild-id"]["user-id"]).toMatchObject({
      xp: 0,
      level: 2
    });
  });
});
