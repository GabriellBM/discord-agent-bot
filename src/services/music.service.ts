import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus
} from "@discordjs/voice";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  GuildMember,
  GuildTextBasedChannel,
  PermissionFlagsBits
} from "discord.js";
import { spawn } from "node:child_process";
import path from "node:path";
import ytdl from "@distube/ytdl-core";
import play from "play-dl";
import { GuildMusicState, LoopMode, MusicVoteType, Track } from "../types/music.types";
import { fetchPublicBotChannel } from "../utils/bot-channel.util";

type MusicAction = () => Promise<void>;

const defaultVolume = 5;
const idleTimeoutMs = 30_000;
const voiceEmptyTimeoutMs = 30_000;
const voteTimeoutMs = 60_000;

export class MusicService {
  private readonly states = new Map<string, GuildMusicState>();

  async play(interaction: ChatInputCommandInteraction, url: string) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const context = await this.getVoiceContext(interaction);

      if (!context) {
        return;
      }

      if (!this.isValidYouTubeUrl(url)) {
        await interaction.editReply({ embeds: [this.errorEmbed("Envie um link válido do YouTube.")] });
        return;
      }

      const state = this.getState(context.guild);
      this.clearIdleTimer(state);
      this.clearVoiceEmptyTimer(state);
      const track = await this.createTrack(url, interaction.user.id);
      const wasIdle = !state.currentTrack && state.queue.length === 0;

      state.textChannelId = interaction.channelId;
      state.voiceChannelId = context.voiceChannel.id;
      state.guild = context.guild;
      state.connection = await this.ensureConnection(context, state);
      state.queue.push(track);

      if (wasIdle) {
        await this.playNext(context.guild.id);
      }

      await interaction.editReply({
        embeds: [
          this.infoEmbed("🎵 Música adicionada à playlist.", [
            ["Título", track.title],
            ["Solicitado por", `<@${track.requestedBy}>`],
            ["Duração", track.duration ?? "Não informada"]
          ], track.url)
        ]
      });
    } catch (error) {
      console.error("Erro ao adicionar música:", error);
      await interaction.editReply({
        embeds: [
          this.errorEmbed(
            `Não consegui carregar essa música. Ela pode estar indisponível, restrita ou o YouTube recusou o stream.\n\nDetalhe: ${this.formatError(error)}`
          )
        ]
      });
    }
  }

  async showPlaylist(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const state = this.states.get(interaction.guildId ?? "");

    if (!state || (!state.currentTrack && state.queue.length === 0)) {
      await interaction.editReply({ embeds: [this.errorEmbed("A playlist está vazia.")] });
      return;
    }

    const upcoming = state.queue.slice(0, 10).map((track, index) => {
      return `${index + 1}. [${track.title}](${track.url}) - <@${track.requestedBy}>`;
    });

    await interaction.editReply({
      embeds: [
        this.infoEmbed("📜 Playlist", [
          ["Tocando agora", state.currentTrack ? `[${state.currentTrack.title}](${state.currentTrack.url})` : "Nada tocando"],
          ["Próximas músicas", upcoming.length > 0 ? upcoming.join("\n") : "Nenhuma"],
          ["Volume", `${state.volume}%`],
          ["Loop", state.loopMode]
        ])
      ]
    });
  }

  async nowPlaying(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const state = this.states.get(interaction.guildId ?? "");

    if (!state?.currentTrack) {
      await interaction.editReply({ embeds: [this.errorEmbed("Não há música tocando agora.")] });
      return;
    }

    await interaction.editReply({
      embeds: [
        this.infoEmbed("🎧 Tocando agora", [
          ["Título", state.currentTrack.title],
          ["Link", state.currentTrack.url],
          ["Solicitado por", `<@${state.currentTrack.requestedBy}>`],
          ["Volume", `${state.volume}%`],
          ["Loop", state.loopMode],
          ["Duração", state.currentTrack.duration ?? "Não informada"]
        ], state.currentTrack.url)
      ]
    });
  }

  async pause(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const validation = await this.validateMusicAction(interaction, true);

    if (!validation) {
      return;
    }

    if (validation.state.player.state.status !== AudioPlayerStatus.Playing) {
      await interaction.editReply({ embeds: [this.errorEmbed("Não há música tocando para pausar.")] });
      return;
    }

    validation.state.player.pause();
    await interaction.editReply({ embeds: [this.successEmbed("⏸️ Música pausada.")] });
  }

  async resume(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const validation = await this.validateMusicAction(interaction, true);

    if (!validation) {
      return;
    }

    if (validation.state.player.state.status !== AudioPlayerStatus.Paused) {
      await interaction.editReply({ embeds: [this.errorEmbed("Não há música pausada para retomar.")] });
      return;
    }

    validation.state.player.unpause();
    await interaction.editReply({ embeds: [this.successEmbed("▶️ Música retomada.")] });
  }

  async skip(interaction: ChatInputCommandInteraction, force: boolean) {
    await this.handleSensitiveAction(interaction, "skip", force, async () => {
      await this.skipNow(interaction.guildId!);
    });
  }

  async stop(interaction: ChatInputCommandInteraction, force: boolean) {
    await this.handleSensitiveAction(interaction, "stop", force, async () => {
      await this.stopNow(interaction.guildId!, true);
    });
  }

  async leave(interaction: ChatInputCommandInteraction, force: boolean) {
    await this.handleSensitiveAction(interaction, "leave", force, async () => {
      await this.leaveNow(interaction.guildId!, true);
    });
  }

  async setVolume(interaction: ChatInputCommandInteraction, volume: number) {
    await interaction.deferReply({ ephemeral: true });

    const validation = await this.validateMusicAction(interaction, false);

    if (!validation) {
      return;
    }

    validation.state.volume = volume;

    const resource = validation.state.player.state.status !== AudioPlayerStatus.Idle
      ? validation.state.player.state.resource
      : undefined;

    resource?.volume?.setVolume(volume / 100);
    await interaction.editReply({ embeds: [this.successEmbed(`🔊 Volume ajustado para ${volume}%.`)] });
  }

  async setLoop(interaction: ChatInputCommandInteraction, mode: LoopMode) {
    await interaction.deferReply({ ephemeral: true });

    const validation = await this.validateMusicAction(interaction, false);

    if (!validation) {
      return;
    }

    validation.state.loopMode = mode;
    await interaction.editReply({ embeds: [this.successEmbed(`🔁 Modo de loop alterado para ${mode}.`)] });
  }

  async handleVote(interaction: ButtonInteraction, type: MusicVoteType, vote: "yes" | "no") {
    if (!interaction.guild) {
      await interaction.reply({ content: "⚠️ Essa votação só funciona em servidores.", ephemeral: true });
      return;
    }

    const state = this.states.get(interaction.guild.id);

    if (!state?.vote || state.vote.type !== type) {
      await interaction.reply({ content: "📭 Não existe votação ativa para essa ação.", ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (member.user.bot || member.voice.channelId !== state.vote.voiceChannelId) {
      await interaction.reply({ content: "🚫 Apenas usuários humanos no mesmo canal de voz podem votar.", ephemeral: true });
      return;
    }

    state.vote.yesVotes.delete(interaction.user.id);
    state.vote.noVotes.delete(interaction.user.id);

    if (vote === "yes") {
      state.vote.yesVotes.add(interaction.user.id);
    } else {
      state.vote.noVotes.add(interaction.user.id);
    }

    const requiredVotes = await this.getRequiredVotes(interaction.guild, state.vote.voiceChannelId);

    if (state.vote.yesVotes.size >= requiredVotes) {
      await interaction.update({ embeds: [this.successEmbed(`✅ Votação aprovada para ${this.voteLabel(type)}.`)], components: [] });
      const action = this.getVoteAction(interaction.guild.id, type);
      state.vote = undefined;
      await action();
      return;
    }

    if (state.vote.noVotes.size >= requiredVotes) {
      await interaction.update({ embeds: [this.errorEmbed(`❌ Votação reprovada para ${this.voteLabel(type)}.`)], components: [] });
      state.vote = undefined;
      return;
    }

    await interaction.update({
      embeds: [this.voteEmbed(type, state.vote.yesVotes.size, state.vote.noVotes.size, requiredVotes)],
      components: [this.voteButtons(interaction.guild.id, type)]
    });
  }

  async handleVoiceStateUpdate(guildId: string) {
    const state = this.states.get(guildId);

    if (!state?.voiceChannelId || !state.guild) {
      return;
    }

    const channel = state.guild.channels.cache.get(state.voiceChannelId);

    if (!channel?.isVoiceBased()) {
      this.clearVoiceEmptyTimer(state);
      return;
    }

    const humanMembers = channel.members.filter((member: GuildMember) => !member.user.bot);

    if (humanMembers.size > 0) {
      this.clearVoiceEmptyTimer(state);
      return;
    }

    this.startVoiceEmptyTimer(guildId, state);
  }

  private async handleSensitiveAction(
    interaction: ChatInputCommandInteraction,
    type: MusicVoteType,
    force: boolean,
    action: MusicAction
  ) {
    await interaction.deferReply({ ephemeral: true });

    const validation = await this.validateMusicAction(interaction, type !== "leave");

    if (!validation) {
      return;
    }

    if (force) {
      if (interaction.user.id !== interaction.guild!.ownerId) {
        await interaction.editReply({ embeds: [this.errorEmbed("Apenas o dono do servidor pode usar comandos absolutos.")] });
        return;
      }

      await action();
      await interaction.editReply({ embeds: [this.successEmbed(`✅ Ação executada: ${this.voteLabel(type)}.`)] });
      return;
    }

    await this.openVote(interaction, type, validation.state);
  }

  private async openVote(interaction: ChatInputCommandInteraction, type: MusicVoteType, state: GuildMusicState) {
    if (state.vote?.type === type) {
      await interaction.editReply({ embeds: [this.errorEmbed("Já existe uma votação desse tipo em andamento.")] });
      return;
    }

    const publicBotChannel = await fetchPublicBotChannel(interaction.guild!, interaction.channelId);

    if (!publicBotChannel) {
      await interaction.editReply({ embeds: [this.errorEmbed("NÃ£o consegui encontrar o canal de interaÃ§Ã£o do bot.")] });
      return;
    }

    const requiredVotes = await this.getRequiredVotes(interaction.guild!, state.voiceChannelId!);
    const reply = await publicBotChannel.send({
      embeds: [this.voteEmbed(type, 0, 0, requiredVotes)],
      components: [this.voteButtons(interaction.guildId!, type)]
    });

    await interaction.editReply({ embeds: [this.successEmbed(`VotaÃ§Ã£o aberta em ${publicBotChannel}.`)] });

    state.vote = {
      type,
      messageId: reply.id,
      channelId: publicBotChannel.id,
      voiceChannelId: state.voiceChannelId!,
      yesVotes: new Set<string>(),
      noVotes: new Set<string>(),
      createdBy: interaction.user.id,
      expiresAt: Date.now() + voteTimeoutMs
    };

    setTimeout(async () => {
      if (state.vote?.messageId !== reply.id) {
        return;
      }

      state.vote = undefined;

      try {
        await reply.edit({
          embeds: [this.errorEmbed("⌛ Votação encerrada sem maioria suficiente.")],
          components: []
        });
      } catch (error) {
        console.error("Erro ao encerrar votação de música:", error);
      }
    }, voteTimeoutMs);
  }

  private async validateMusicAction(interaction: ChatInputCommandInteraction, requireTrack: boolean) {
    if (!interaction.guild) {
      await interaction.editReply({ embeds: [this.errorEmbed("Este comando só pode ser usado em um servidor.")] });
      return null;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply({ embeds: [this.errorEmbed("Você precisa estar em um canal de voz.")] });
      return null;
    }

    const state = this.states.get(interaction.guild.id);

    if (!state) {
      await interaction.editReply({ embeds: [this.errorEmbed("Não há player de música ativo neste servidor.")] });
      return null;
    }

    if (state.voiceChannelId && state.voiceChannelId !== voiceChannel.id) {
      await interaction.editReply({ embeds: [this.errorEmbed("Você precisa estar no mesmo canal de voz que eu.")] });
      return null;
    }

    if (requireTrack && !state.currentTrack) {
      await interaction.editReply({ embeds: [this.errorEmbed("Não há música tocando agora.")] });
      return null;
    }

    return { member, state };
  }

  private async getVoiceContext(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.editReply({ embeds: [this.errorEmbed("Este comando só pode ser usado em um servidor.")] });
      return null;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply({ embeds: [this.errorEmbed("Você precisa estar em um canal de voz para tocar música.")] });
      return null;
    }

    const state = this.states.get(interaction.guild.id);

    if (state?.voiceChannelId && state.voiceChannelId !== voiceChannel.id) {
      await interaction.editReply({ embeds: [this.errorEmbed("Você precisa estar no mesmo canal de voz que eu.")] });
      return null;
    }

    const botMember = interaction.guild.members.me;
    const permissions = botMember ? voiceChannel.permissionsFor(botMember) : null;

    if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      await interaction.editReply({ embeds: [this.errorEmbed("Preciso de permissão para conectar e falar nesse canal de voz.")] });
      return null;
    }

    return {
      guild: interaction.guild,
      member,
      voiceChannel
    };
  }

  private getState(guild: Guild) {
    let state = this.states.get(guild.id);

    if (state) {
      return state;
    }

    const player = createAudioPlayer();

    state = {
      queue: [],
      history: [],
      player,
      volume: defaultVolume,
      loopMode: "off"
    };

    player.on(AudioPlayerStatus.Idle, () => {
      void this.handleIdle(guild.id);
    });

    player.on("error", (error) => {
      console.error("Erro no player de música:", error);
      void this.playNext(guild.id);
    });

    this.states.set(guild.id, state);
    return state;
  }

  private async ensureConnection(
    context: NonNullable<Awaited<ReturnType<MusicService["getVoiceContext"]>>>,
    state: GuildMusicState
  ) {
    const existingConnection = getVoiceConnection(context.guild.id);

    if (existingConnection) {
      existingConnection.subscribe(state.player);
      return existingConnection;
    }

    const connection = joinVoiceChannel({
      channelId: context.voiceChannel.id,
      guildId: context.guild.id,
      adapterCreator: context.guild.voiceAdapterCreator
    });

    connection.subscribe(state.player);
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    return connection;
  }

  private async createTrack(url: string, requestedBy: string): Promise<Track> {
    const normalizedUrl = this.normalizeYouTubeUrl(url);

    try {
      const info = await play.video_info(normalizedUrl);
      const details = info.video_details;

      return {
        title: details.title ?? "Música do YouTube",
        url: details.url ?? normalizedUrl,
        originalUrl: normalizedUrl,
        requestedBy,
        duration: details.durationInSec ? this.formatDuration(details.durationInSec) : undefined
      };
    } catch (playError) {
      console.error("play-dl não conseguiu buscar informações do vídeo, tentando ytdl:", playError);
      const info = await ytdl.getInfo(normalizedUrl, {
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        }
      });
      const details = info.videoDetails;

      return {
        title: details.title,
        url: details.video_url,
        originalUrl: normalizedUrl,
        requestedBy,
        duration: details.lengthSeconds ? this.formatDuration(Number(details.lengthSeconds)) : undefined
      };
    }
  }

  private async playNext(guildId: string) {
    const state = this.states.get(guildId);

    if (!state) {
      return;
    }

    this.clearIdleTimer(state);

    let nextTrack: Track | undefined;

    if (state.loopMode === "track" && state.currentTrack) {
      nextTrack = state.currentTrack;
    } else {
      if (state.loopMode === "playlist" && state.currentTrack) {
        state.queue.push(state.currentTrack);
      } else if (state.currentTrack) {
        state.history.push(state.currentTrack);
      }

      nextTrack = state.queue.shift();
    }

    if (!nextTrack) {
      state.currentTrack = undefined;
      this.startIdleTimer(guildId, state);
      return;
    }

    try {
      state.currentTrack = nextTrack;
      const resource = await this.createResource(nextTrack);

      resource.volume?.setVolume(state.volume / 100);
      state.player.play(resource);
    } catch (error) {
      console.error(`Erro ao tocar música ${nextTrack.title}:`, error);
      await this.playNext(guildId);
    }
  }

  private async handleIdle(guildId: string) {
    await this.playNext(guildId);
  }

  private startIdleTimer(guildId: string, state: GuildMusicState) {
    if (state.idleTimeout || state.player.state.status === AudioPlayerStatus.Paused) {
      return;
    }

    state.idleTimeout = setTimeout(async () => {
      const channel = await this.fetchTextChannel(guildId, state.textChannelId);

      await this.leaveNow(guildId, false);
      await channel?.send("👋 Saí da sala de voz por inatividade.");
    }, idleTimeoutMs);
  }

  private clearIdleTimer(state: GuildMusicState) {
    if (!state.idleTimeout) {
      return;
    }

    clearTimeout(state.idleTimeout);
    state.idleTimeout = undefined;
  }

  private startVoiceEmptyTimer(guildId: string, state: GuildMusicState) {
    if (state.voiceEmptyTimeout) {
      return;
    }

    state.voiceEmptyTimeout = setTimeout(async () => {
      const currentState = this.states.get(guildId);

      if (!currentState?.voiceChannelId || !currentState.guild) {
        return;
      }

      const channel = currentState.guild.channels.cache.get(currentState.voiceChannelId);

      if (channel?.isVoiceBased()) {
        const humanMembers = channel.members.filter((member: GuildMember) => !member.user.bot);

        if (humanMembers.size > 0) {
          this.clearVoiceEmptyTimer(currentState);
          return;
        }
      }

      const textChannel = await this.fetchTextChannel(guildId, currentState.textChannelId);

      await this.leaveNow(guildId, true);
      await textChannel?.send("👋 Saí da sala de voz porque não havia mais ninguém no canal.");
    }, voiceEmptyTimeoutMs);
  }

  private clearVoiceEmptyTimer(state: GuildMusicState) {
    if (!state.voiceEmptyTimeout) {
      return;
    }

    clearTimeout(state.voiceEmptyTimeout);
    state.voiceEmptyTimeout = undefined;
  }

  private async skipNow(guildId: string) {
    const state = this.states.get(guildId);

    if (!state) {
      return;
    }

    state.player.stop(true);
  }

  private async stopNow(guildId: string, destroyConnection: boolean) {
    const state = this.states.get(guildId);

    if (!state) {
      return;
    }

    state.queue = [];
    state.currentTrack = undefined;
    state.history = [];
    state.vote = undefined;
    state.player.stop(true);

    if (destroyConnection) {
      await this.leaveNow(guildId, true);
    } else {
      this.startIdleTimer(guildId, state);
    }
  }

  private async leaveNow(guildId: string, clearState: boolean) {
    const state = this.states.get(guildId);
    const connection = getVoiceConnection(guildId) ?? state?.connection;

    if (state) {
      this.clearIdleTimer(state);
      this.clearVoiceEmptyTimer(state);
      state.queue = [];
      state.currentTrack = undefined;
      state.vote = undefined;
      state.player.stop(true);
    }

    connection?.destroy();

    if (clearState) {
      this.states.delete(guildId);
    } else {
      this.states.delete(guildId);
    }
  }

  private getVoteAction(guildId: string, type: MusicVoteType): MusicAction {
    if (type === "skip") {
      return () => this.skipNow(guildId);
    }

    if (type === "stop") {
      return () => this.stopNow(guildId, true);
    }

    return () => this.leaveNow(guildId, true);
  }

  private async getRequiredVotes(guild: Guild, voiceChannelId: string) {
    const channel = guild.channels.cache.get(voiceChannelId);

    if (!channel?.isVoiceBased()) {
      return 1;
    }

    const totalHumans = channel.members.filter((member: GuildMember) => !member.user.bot).size;
    return Math.floor(totalHumans / 2) + 1;
  }

  private voteButtons(guildId: string, type: MusicVoteType) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`music_vote_yes:${guildId}:${type}`)
        .setLabel("Aprovar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`music_vote_no:${guildId}:${type}`)
        .setLabel("Reprovar")
        .setStyle(ButtonStyle.Danger)
    );
  }

  private voteEmbed(type: MusicVoteType, yesVotes: number, noVotes: number, requiredVotes: number) {
    return this.infoEmbed("🗳️ Votação aberta", [
      ["Ação", this.voteLabel(type)],
      ["Aprovações", `${yesVotes}/${requiredVotes}`],
      ["Reprovações", `${noVotes}/${requiredVotes}`],
      ["Duração", "60 segundos"]
    ]);
  }

  private voteLabel(type: MusicVoteType) {
    const labels = {
      skip: "pular música",
      stop: "parar música",
      leave: "sair do canal de voz"
    };

    return labels[type];
  }

  private async fetchTextChannel(guildId: string, channelId?: string) {
    if (!channelId) {
      return null;
    }

    const state = this.states.get(guildId);

    try {
      return state?.guild ? fetchPublicBotChannel(state.guild, channelId) : null;
    } catch (error) {
      console.error("Erro ao buscar canal de texto de música:", error);
      return null;
    }
  }

  private infoEmbed(title: string, fields: Array<[string, string]>, url?: string) {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x5865f2);

    if (url) {
      embed.setURL(url);
    }

    embed.addFields(fields.map(([name, value]) => ({ name, value: value || "-", inline: false })));
    return embed;
  }

  private successEmbed(description: string) {
    return new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(description);
  }

  private errorEmbed(description: string) {
    return new EmbedBuilder()
      .setColor(0xff5555)
      .setDescription(description);
  }

  private formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.message.slice(0, 300);
    }

    return "erro desconhecido";
  }

  private isValidYouTubeUrl(url: string) {
    return ytdl.validateURL(url) || play.yt_validate(url) === "video";
  }

  private async createResource(track: Track) {
    const sourceUrl = this.normalizeYouTubeUrl(track.originalUrl ?? track.url);

    if (!sourceUrl) {
      throw new Error("Track sem URL de origem.");
    }

    const subprocess = spawn(this.getYtDlpBinaryPath(), [
      sourceUrl,
      "--output",
      "-",
      "--format",
      "bestaudio[acodec=opus][ext=webm]/bestaudio[ext=webm]/bestaudio/best",
      "--no-playlist",
      "--no-cache-dir",
      "--ignore-config",
      "--quiet",
      "--no-warnings"
    ], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    subprocess.stderr?.on("data", (chunk) => {
      const message = String(chunk).trim();

      if (message) {
        console.error(`yt-dlp (${track.title}): ${message}`);
      }
    });

    subprocess.stdout?.on("error", (error) => {
      console.error(`Erro no stdout do yt-dlp de ${track.title}:`, error);
    });

    subprocess.on("error", (error) => {
      console.error(`Erro no processo yt-dlp de ${track.title}:`, error);
    });

    subprocess.on("close", (code) => {
      if (code && code !== 0) {
        console.error(`yt-dlp encerrou com codigo ${code} em ${track.title}.`);
      }
    });

    if (!subprocess.stdout) {
      throw new Error("yt-dlp nao abriu stream de audio.");
    }

    return createAudioResource(subprocess.stdout, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true
    });
  }

  private normalizeYouTubeUrl(url: string) {
    try {
      const videoId = ytdl.getURLVideoID(url);
      return `https://www.youtube.com/watch?v=${videoId}`;
    } catch {
      return url;
    }
  }

  private getYtDlpBinaryPath() {
    const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

    return path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", binaryName);
  }
}

export const musicService = new MusicService();
