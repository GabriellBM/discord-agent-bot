import { describe, expect, it, vi } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import {
  checkBotPermission,
  checkRoleHierarchy,
  checkTargetIsNotOwner,
  checkUserPermission,
  validateModerationAction
} from "../src/utils/permission.util";

function createInteraction(options: {
  userHasPermission?: boolean;
  botHasPermission?: boolean;
  ownerId?: string;
  deferred?: boolean;
  replied?: boolean;
} = {}) {
  return {
    deferred: options.deferred ?? false,
    replied: options.replied ?? false,
    reply: vi.fn(),
    editReply: vi.fn(),
    memberPermissions: {
      has: vi.fn(() => options.userHasPermission ?? true)
    },
    guild: {
      ownerId: options.ownerId ?? "owner-id",
      members: {
        me: {
          permissions: {
            has: vi.fn(() => options.botHasPermission ?? true)
          },
          roles: {
            highest: {
              position: 10
            }
          }
        }
      }
    }
  };
}

function createTarget(options: {
  id?: string;
  rolePosition?: number;
  kickable?: boolean;
  bannable?: boolean;
  moderatable?: boolean;
} = {}) {
  return {
    id: options.id ?? "target-id",
    kickable: options.kickable ?? true,
    bannable: options.bannable ?? true,
    moderatable: options.moderatable ?? true,
    roles: {
      highest: {
        position: options.rolePosition ?? 1
      }
    }
  };
}

describe("permission.util", () => {
  it("aprova quando o usuario possui permissao", async () => {
    const interaction = createInteraction({ userHasPermission: true });

    await expect(checkUserPermission(interaction as never, PermissionFlagsBits.KickMembers)).resolves.toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("responde ephemeral quando o usuario nao possui permissao", async () => {
    const interaction = createInteraction({ userHasPermission: false });

    await expect(checkUserPermission(interaction as never, PermissionFlagsBits.KickMembers)).resolves.toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it("usa editReply quando a interaction ja foi deferida", async () => {
    const interaction = createInteraction({ userHasPermission: false, deferred: true });

    await checkUserPermission(interaction as never, PermissionFlagsBits.KickMembers);

    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("valida permissao do bot", async () => {
    const interaction = createInteraction({ botHasPermission: false });

    await expect(checkBotPermission(interaction as never, PermissionFlagsBits.BanMembers)).resolves.toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it("impede acao contra o owner do servidor", async () => {
    const interaction = createInteraction({ ownerId: "target-id" });
    const target = createTarget({ id: "target-id" });

    await expect(checkTargetIsNotOwner(interaction as never, target as never)).resolves.toBe(false);
  });

  it("impede acao quando hierarquia do alvo e maior ou igual a do bot", async () => {
    const interaction = createInteraction();
    const target = createTarget({ rolePosition: 10 });

    await expect(checkRoleHierarchy(interaction as never, target as never)).resolves.toBe(false);
  });

  it("valida fluxo completo de moderacao com sucesso", async () => {
    const interaction = createInteraction();
    const target = createTarget({ kickable: true, rolePosition: 1 });

    await expect(
      validateModerationAction(interaction as never, target as never, {
        permission: PermissionFlagsBits.KickMembers,
        action: "kick"
      })
    ).resolves.toBe(true);
  });

  it("bloqueia acao quando target nao e kickable", async () => {
    const interaction = createInteraction();
    const target = createTarget({ kickable: false, rolePosition: 1 });

    await expect(
      validateModerationAction(interaction as never, target as never, {
        permission: PermissionFlagsBits.KickMembers,
        action: "kick"
      })
    ).resolves.toBe(false);
  });
});
