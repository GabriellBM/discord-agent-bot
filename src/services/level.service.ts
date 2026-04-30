import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Guild,
  GuildMember,
  Role,
  GuildTextBasedChannel,
  PermissionFlagsBits
} from "discord.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUTOMOD_CONFIG } from "../config/automod.config";
import {
  HIGHER_THAN_MAX_ROLE,
  LEVEL_CONFIG,
  LEVEL_ROLES,
  MAX_LEVEL,
  MAX_LEVEL_ROLE
} from "../config/level.config";
import { isUserImmune } from "../utils/automod.util";
import { LogService } from "./log.service";

export interface UserLevelData {
  xp: number;
  level: number;
  messages: number;
  lastXpAt: number;
}

type GuildLevelData = Record<string, UserLevelData>;
type LevelDatabase = Record<string, GuildLevelData>;

interface AddXpResult {
  data: UserLevelData;
  gainedXp: number;
  leveledUp: boolean;
  onCooldown: boolean;
}

interface PendingMaxRoleRequest {
  channelId: string;
  level: number;
}

const defaultLevelsFilePath = path.join(process.cwd(), "src", "data", "levels.json");
const pendingMaxRoleRequests = new Map<string, PendingMaxRoleRequest>();
const pendingHigherRoleRequests = new Map<string, PendingMaxRoleRequest>();
const logService = new LogService();

export class LevelService {
  constructor(private readonly levelsFilePath = defaultLevelsFilePath) {}

  async getUser(guildId: string, userId: string) {
    const database = await this.readDatabase();
    return this.getOrCreateUser(database, guildId, userId);
  }

  async addMessageXp(guildId: string, userId: string): Promise<AddXpResult> {
    const database = await this.readDatabase();
    const userData = this.getOrCreateUser(database, guildId, userId);
    const now = Date.now();

    userData.messages += 1;

    if (now - userData.lastXpAt < LEVEL_CONFIG.cooldownSeconds * 1000) {
      await this.writeDatabase(database);

      return {
        data: userData,
        gainedXp: 0,
        leveledUp: false,
        onCooldown: true
      };
    }

    const gainedXp = this.getRandomXp();
    let leveledUp = false;

    userData.xp += gainedXp;
    userData.lastXpAt = now;

    while (userData.xp >= this.getRequiredXp(userData.level)) {
      userData.xp -= this.getRequiredXp(userData.level);
      userData.level += 1;
      leveledUp = true;
    }

    await this.writeDatabase(database);

    return {
      data: userData,
      gainedXp,
      leveledUp,
      onCooldown: false
    };
  }

  async getLeaderboard(guild: Guild, limit = 10) {
    const database = await this.readDatabase();
    const guildData = database[guild.id] ?? {};
    const rankedUsers = Object.entries(guildData)
      .sort(([, firstUser], [, secondUser]) => {
        if (secondUser.level !== firstUser.level) {
          return secondUser.level - firstUser.level;
        }

        return secondUser.xp - firstUser.xp;
      });

    const leaderboard = [];

    for (const [userId, data] of rankedUsers) {
      if (leaderboard.length >= limit) {
        break;
      }

      try {
        const member = await guild.members.fetch(userId);

        if (member.user.bot) {
          continue;
        }

        leaderboard.push({ member, data });
      } catch {
        continue;
      }
    }

    return leaderboard;
  }

  getRequiredXp(level: number) {
    return 100 * level;
  }

  async applyXpPenalty(member: GuildMember, amount = AUTOMOD_CONFIG.moderation.xpPenalty) {
    if (isUserImmune(member)) {
      console.log("Usuario imune nao recebeu penalidade de XP.");
      return null;
    }

    const database = await this.readDatabase();
    const userData = this.getOrCreateUser(database, member.guild.id, member.id);

    userData.xp -= amount;

    while (userData.xp < 0 && userData.level > 1) {
      userData.level -= 1;
      userData.xp += this.getRequiredXp(userData.level);
    }

    if (userData.xp < 0) {
      userData.xp = 0;
    }

    await this.writeDatabase(database);
    return userData;
  }

  async addUserXp(guildId: string, userId: string, amount: number) {
    const database = await this.readDatabase();
    const userData = this.getOrCreateUser(database, guildId, userId);

    userData.xp += amount;
    this.normalizeLevelData(userData);

    await this.writeDatabase(database);
    return userData;
  }

  async removeUserXp(guildId: string, userId: string, amount: number) {
    const database = await this.readDatabase();
    const userData = this.getOrCreateUser(database, guildId, userId);

    userData.xp -= amount;
    this.normalizeLevelData(userData);

    await this.writeDatabase(database);
    return userData;
  }

  async setUserXp(guildId: string, userId: string, amount: number) {
    const database = await this.readDatabase();
    const userData = this.getOrCreateUser(database, guildId, userId);

    userData.xp = amount;
    this.normalizeLevelData(userData);

    await this.writeDatabase(database);
    return userData;
  }

  async resetUserLevel(guildId: string, userId: string) {
    const database = await this.readDatabase();

    database[guildId] ??= {};
    database[guildId][userId] = {
      xp: 0,
      level: 1,
      messages: 0,
      lastXpAt: 0
    };

    await this.writeDatabase(database);
    return database[guildId][userId];
  }

  async applyLevelRoles(member: GuildMember, level: number) {
    try {
      const botMember = member.guild.members.me;

      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        console.log("Nao foi possivel aplicar cargos acumulativos de level: bot sem ManageRoles.");
        return;
      }

      const sortedLevelRoles = [...LEVEL_ROLES].sort((firstRole, secondRole) => firstRole.level - secondRole.level);
      const unlockedRoleConfigs = sortedLevelRoles.filter((roleConfig) => level >= roleConfig.level);

      for (const roleConfig of unlockedRoleConfigs) {
        const role = member.guild.roles.cache.get(roleConfig.roleId);

        if (!role) {
          console.log(`Cargo de level nao encontrado: ${roleConfig.roleId}`);
          continue;
        }

        if (role.position >= botMember.roles.highest.position) {
          console.log(`Cargo acumulativo de level acima ou igual ao cargo do bot: ${role.name}`);
          continue;
        }

        if (member.roles.cache.has(role.id)) {
          continue;
        }

        await member.roles.add(role, "Cargo automatico acumulativo por level");
      }
    } catch (error) {
      console.error("Erro ao aplicar cargos acumulativos de level:", error);
    }
  }

  async removeInvalidLevelRoles(member: GuildMember, level: number) {
    const removedRoles: Role[] = [];

    if (isUserImmune(member)) {
      console.log("Usuario imune: cargos por penalidade nao serao removidos.");
      return removedRoles;
    }

    try {
      const botMember = member.guild.members.me;

      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        console.log("Nao foi possivel remover cargos invalidos de level: bot sem ManageRoles.");
        return removedRoles;
      }

      const invalidLevelRoles = LEVEL_ROLES.filter((roleConfig) => roleConfig.level > level);

      for (const roleConfig of invalidLevelRoles) {
        if (AUTOMOD_CONFIG.ignoredRoleIds.includes(roleConfig.roleId)) {
          continue;
        }

        const role = member.guild.roles.cache.get(roleConfig.roleId);

        if (!role || !member.roles.cache.has(role.id)) {
          continue;
        }

        if (role.position >= botMember.roles.highest.position) {
          console.log(`Cargo invalido de level acima ou igual ao cargo do bot: ${role.name}`);
          continue;
        }

        await member.roles.remove(role, "Remocao de cargo por penalidade automatica de XP");
        removedRoles.push(role);
      }

      return removedRoles;
    } catch (error) {
      console.error("Erro ao remover cargos invalidos de level:", error);
      return removedRoles;
    }
  }

  async requestMaxRoleApproval(member: GuildMember, level: number, channel: GuildTextBasedChannel) {
    if (level < MAX_LEVEL) {
      return;
    }

    const requestKey = this.getMaxRoleRequestKey(member.guild.id, member.id);

    if (member.roles.cache.has(MAX_LEVEL_ROLE.roleId)) {
      return;
    }

    if (pendingMaxRoleRequests.has(requestKey)) {
      return;
    }

    pendingMaxRoleRequests.set(requestKey, {
      channelId: channel.id,
      level
    });

    try {
      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_max_role:${member.guild.id}:${member.id}`)
          .setLabel("Aprovar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_max_role:${member.guild.id}:${member.id}`)
          .setLabel("Reprovar")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: [
          `📨 <@${member.guild.ownerId}> solicitação de cargo máximo recebida.`,
          `Usuário: ${member.displayName}`,
          `Nível atual: ${level}`,
          `Cargo MAX solicitado`
        ].join("\n"),
        components: [actionRow]
      });
      await logService.send(member.guild, "Log de Cargo MAX", [
        `Acao: solicitacao enviada no canal`,
        `Usuario: ${member.user.tag}`,
        `ID do usuario: ${member.id}`,
        `Nivel atual: ${level}`,
        `Cargo MAX solicitado: ${MAX_LEVEL_ROLE.roleId}`
      ]);
    } catch (error) {
      console.error("Erro ao enviar solicitacao de cargo maximo no canal:", error);
      await channel.send(
        "⚠️ Não foi possível enviar a solicitação ao dono do servidor. A aprovação do cargo máximo ficou pendente."
      );
      await logService.send(member.guild, "Log de Cargo MAX", [
        `Acao: falha ao enviar solicitacao no canal`,
        `Usuario: ${member.user.tag}`,
        `ID do usuario: ${member.id}`,
        `Nivel atual: ${level}`,
        `Erro: ${error instanceof Error ? error.message : "erro desconhecido"}`
      ]);
    }
  }

  async handleMaxRoleApproval(interaction: ButtonInteraction, approved: boolean, guildId: string, userId: string) {
    try {
      const guild = await interaction.client.guilds.fetch(guildId);

      if (interaction.user.id !== guild.ownerId) {
        await interaction.reply({
          content: "Apenas o dono do servidor pode aprovar ou reprovar esta solicitação.",
          ephemeral: true
        });
        return;
      }

      const requestKey = this.getMaxRoleRequestKey(guildId, userId);
      const pendingRequest = pendingMaxRoleRequests.get(requestKey);

      if (!pendingRequest) {
        await interaction.reply({
          content: "📭 Não existe uma solicitação pendente para este usuário.",
          ephemeral: true
        });
        return;
      }

      const member = await guild.members.fetch(userId);
      const channel = await this.fetchAnnouncementChannel(guild, pendingRequest.channelId);

      if (!approved) {
        pendingMaxRoleRequests.delete(requestKey);
        await interaction.reply("❌ Solicitação de cargo máximo reprovada.");
        await channel?.send(
          `⚠️ ${member.displayName} atingiu o nível máximo, mas a conquista do cargo final não foi aprovada neste momento.`
        );
        return;
      }

      const applied = await this.applyMaxRole(member);

      if (!applied.ok) {
        await interaction.reply({
          content: `⚠️ Não foi possível aplicar o cargo máximo: ${applied.reason}`,
          ephemeral: true
        });
        return;
      }

      pendingMaxRoleRequests.delete(requestKey);
      await interaction.reply("✅ Solicitação de cargo máximo aprovada.");
      await channel?.send(
        `🔥 Parabéns, ${member.displayName}! Sua conquista de nível máximo foi aprovada e você recebeu o cargo final.`
      );
    } catch (error) {
      console.error("Erro ao processar aprovacao de cargo maximo:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "⚠️ Não consegui processar esta solicitação agora.",
          ephemeral: true
        });
      }
    }
  }

  async requestHigherRoleApproval(member: GuildMember, channel: GuildTextBasedChannel) {
    if (!member.roles.cache.has(MAX_LEVEL_ROLE.roleId)) {
      await channel.send(`🚫 ${member}, você precisa ter o cargo MAX para solicitar o cargo superior.`);
      return;
    }

    if (member.roles.cache.has(HIGHER_THAN_MAX_ROLE.roleId)) {
      await channel.send(`✅ ${member}, você já possui o cargo superior.`);
      return;
    }

    const requestKey = this.getMaxRoleRequestKey(member.guild.id, member.id);

    if (pendingHigherRoleRequests.has(requestKey)) {
      await channel.send(`📭 ${member}, você já possui uma solicitação de cargo superior pendente.`);
      return;
    }

    pendingHigherRoleRequests.set(requestKey, {
      channelId: channel.id,
      level: 0
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_higher_role:${member.guild.id}:${member.id}`)
        .setLabel("Aprovar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_higher_role:${member.guild.id}:${member.id}`)
        .setLabel("Reprovar")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: [
        `📨 <@${member.guild.ownerId}> solicitação de cargo superior recebida.`,
        `Usuário: ${member.displayName}`,
        `Cargo superior solicitado`
      ].join("\n"),
      components: [actionRow]
    });

    await logService.send(member.guild, "Log de Cargo Superior", [
      `Acao: solicitacao enviada no canal`,
      `Usuario: ${member.user.tag}`,
      `ID do usuario: ${member.id}`,
      `Cargo solicitado: ${HIGHER_THAN_MAX_ROLE.roleId}`
    ]);
  }

  async handleHigherRoleApproval(interaction: ButtonInteraction, approved: boolean, guildId: string, userId: string) {
    try {
      const guild = await interaction.client.guilds.fetch(guildId);

      if (interaction.user.id !== guild.ownerId) {
        await interaction.reply({
          content: "🚫 Apenas o dono do servidor pode aprovar ou reprovar esta solicitação.",
          ephemeral: true
        });
        return;
      }

      const requestKey = this.getMaxRoleRequestKey(guildId, userId);
      const pendingRequest = pendingHigherRoleRequests.get(requestKey);

      if (!pendingRequest) {
        await interaction.reply({
          content: "📭 Não existe uma solicitação pendente para este usuário.",
          ephemeral: true
        });
        return;
      }

      const member = await guild.members.fetch(userId);
      const channel = await this.fetchAnnouncementChannel(guild, pendingRequest.channelId);

      if (!approved) {
        pendingHigherRoleRequests.delete(requestKey);
        await interaction.reply("❌ Solicitação de cargo superior reprovada.");
        await channel?.send(`${member.displayName}, sua solicitação de cargo superior não foi aprovada neste momento.`);
        return;
      }

      const applied = await this.applyConfiguredRole(
        member,
        HIGHER_THAN_MAX_ROLE.roleId,
        "Cargo superior aprovado manualmente pelo owner"
      );

      if (!applied.ok) {
        await interaction.reply({
          content: `⚠️ Não foi possível aplicar o cargo superior: ${applied.reason}`,
          ephemeral: true
        });
        return;
      }

      pendingHigherRoleRequests.delete(requestKey);
      await interaction.reply("✅ Solicitação de cargo superior aprovada.");
      await channel?.send(`🎉 ${member.displayName}, sua solicitação foi aprovada e você recebeu o cargo superior.`);
    } catch (error) {
      console.error("Erro ao processar aprovacao de cargo superior:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "⚠️ Não consegui processar esta solicitação agora.",
          ephemeral: true
        });
      }
    }
  }

  private async applyMaxRole(member: GuildMember) {
    return this.applyConfiguredRole(
      member,
      MAX_LEVEL_ROLE.roleId,
      "Cargo maximo aprovado manualmente pelo owner"
    );
  }

  private async applyConfiguredRole(member: GuildMember, roleId: string, reason: string) {
    const botMember = member.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.log("Nao foi possivel aplicar cargo: bot sem ManageRoles.");
      return {
        ok: false,
        reason: "o bot não tem permissão Manage Roles."
      };
    }

    const role = member.guild.roles.cache.get(roleId);

    if (!role) {
      console.log(`Cargo nao encontrado: ${roleId}`);
      return {
        ok: false,
        reason: "o cargo configurado não existe no servidor."
      };
    }

    if (role.position >= botMember.roles.highest.position) {
      console.log(`Cargo acima ou igual ao cargo do bot: ${role.name}`);
      return {
        ok: false,
        reason: `o cargo ${role.name} está acima ou no mesmo nível do cargo do bot.`
      };
    }

    if (member.roles.cache.has(role.id)) {
      return {
        ok: true,
        reason: "usuário já possui o cargo."
      };
    }

    await member.roles.add(role, reason);
    return {
      ok: true,
      reason: "cargo aplicado."
    };
  }

  private async fetchAnnouncementChannel(guild: Guild, channelId: string) {
    const channel = await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      return channel;
    }

    return null;
  }

  private getRandomXp() {
    const min = LEVEL_CONFIG.minXpPerMessage;
    const max = LEVEL_CONFIG.maxXpPerMessage;

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getOrCreateUser(database: LevelDatabase, guildId: string, userId: string) {
    database[guildId] ??= {};
    database[guildId][userId] ??= {
      xp: 0,
      level: 1,
      messages: 0,
      lastXpAt: 0
    };

    return database[guildId][userId];
  }

  private normalizeLevelData(userData: UserLevelData) {
    while (userData.xp >= this.getRequiredXp(userData.level)) {
      userData.xp -= this.getRequiredXp(userData.level);
      userData.level += 1;
    }

    while (userData.xp < 0 && userData.level > 1) {
      userData.level -= 1;
      userData.xp += this.getRequiredXp(userData.level);
    }

    if (userData.xp < 0) {
      userData.xp = 0;
    }
  }

  private getMaxRoleRequestKey(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
  }

  private async readDatabase(): Promise<LevelDatabase> {
    try {
      await mkdir(path.dirname(this.levelsFilePath), { recursive: true });
      const content = await readFile(this.levelsFilePath, "utf-8");

      if (!content.trim()) {
        return {};
      }

      return JSON.parse(content) as LevelDatabase;
    } catch (error) {
      await writeFile(this.levelsFilePath, "{}\n", "utf-8");
      return {};
    }
  }

  private async writeDatabase(database: LevelDatabase) {
    await mkdir(path.dirname(this.levelsFilePath), { recursive: true });
    await writeFile(this.levelsFilePath, `${JSON.stringify(database, null, 2)}\n`, "utf-8");
  }
}
