import { afterEach, describe, expect, it } from "vitest";
import { AUTOMOD_CONFIG } from "../src/config/automod.config";
import {
  findForbiddenWord,
  getImmunityReason,
  getModerationRuleForMember,
  isUserImmune
} from "../src/utils/automod.util";

const originalIgnoredRoleIds = [...AUTOMOD_CONFIG.ignoredRoleIds];
const originalIgnoredUserIds = [...AUTOMOD_CONFIG.ignoredUserIds];
const originalRoleToleranceRules = [...AUTOMOD_CONFIG.roleToleranceRules];

function createMember(options: {
  id?: string;
  ownerId?: string;
  bot?: boolean;
  roleIds?: string[];
}) {
  const roleIds = options.roleIds ?? [];
  const roles = roleIds.map((id) => ({ id, name: `role-${id}` }));

  return {
    id: options.id ?? "user-id",
    user: {
      bot: options.bot ?? false
    },
    guild: {
      ownerId: options.ownerId ?? "owner-id"
    },
    roles: {
      cache: {
        has: (roleId: string) => roleIds.includes(roleId),
        some: (predicate: (role: { id: string; name: string }) => boolean) => roles.some(predicate),
        find: (predicate: (role: { id: string; name: string }) => boolean) => roles.find(predicate)
      }
    }
  };
}

describe("automod.util", () => {
  afterEach(() => {
    AUTOMOD_CONFIG.ignoredRoleIds.splice(0, AUTOMOD_CONFIG.ignoredRoleIds.length, ...originalIgnoredRoleIds);
    AUTOMOD_CONFIG.ignoredUserIds.splice(0, AUTOMOD_CONFIG.ignoredUserIds.length, ...originalIgnoredUserIds);
    AUTOMOD_CONFIG.roleToleranceRules.splice(0, AUTOMOD_CONFIG.roleToleranceRules.length, ...originalRoleToleranceRules);
  });

  it("detecta palavras proibidas ignorando acentos e pontuacao", () => {
    const result = findForbiddenWord("v.a.i   s-e   f-u-d-e-r agora");

    expect(result.matched).toBe(true);
    expect(result.word).toBe("vai se fuder");
  });

  it("detecta abreviacoes mascaradas por espacos", () => {
    const result = findForbiddenWord("isso foi v s f demais");

    expect(result.matched).toBe(true);
    expect(result.word).toBe("vsf");
  });

  it("nao detecta texto limpo na lista local", () => {
    expect(findForbiddenWord("boa noite pessoal").matched).toBe(false);
  });

  it("considera owner, bots, usuarios e cargos em whitelist como imunes", () => {
    AUTOMOD_CONFIG.ignoredUserIds.push("ignored-user");
    AUTOMOD_CONFIG.ignoredRoleIds.push("ignored-role");

    expect(isUserImmune(createMember({ id: "owner-id", ownerId: "owner-id" }) as never)).toBe(true);
    expect(isUserImmune(createMember({ bot: true }) as never)).toBe(true);
    expect(isUserImmune(createMember({ id: "ignored-user" }) as never)).toBe(true);
    expect(isUserImmune(createMember({ roleIds: ["ignored-role"] }) as never)).toBe(true);
  });

  it("retorna motivo de imunidade para cargo ignorado", () => {
    AUTOMOD_CONFIG.ignoredRoleIds.push("mod-role");

    expect(getImmunityReason(createMember({ roleIds: ["mod-role"] }) as never)).toBe("cargo imune: role-mod-role");
  });

  it("usa a regra de tolerancia com menor penalidade para o membro", () => {
    AUTOMOD_CONFIG.roleToleranceRules.push(
      {
        roleId: "vip",
        xpPenalty: 25,
        timeoutMinutes: 5,
        deleteMessage: true
      },
      {
        roleId: "trusted",
        xpPenalty: 10,
        timeoutMinutes: 0,
        deleteMessage: false
      }
    );

    const rule = getModerationRuleForMember(createMember({ roleIds: ["vip", "trusted"] }) as never, false);

    expect(rule).toEqual({
      xpPenalty: 10,
      timeoutMinutes: 0,
      deleteMessage: false
    });
  });
});
