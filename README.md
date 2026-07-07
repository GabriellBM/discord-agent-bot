# Leigos Academy Discord Bot

<p align="center">
  <strong>Bot Discord modular, completo e extensivel feito com Node.js, TypeScript e discord.js v14.</strong>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="discord.js" src="https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white">
  <img alt="OpenAI" src="https://img.shields.io/badge/OpenAI-Moderation%20API-111111?style=for-the-badge&logo=openai&logoColor=white">
</p>

<p align="center">
  Moderacao, XP, niveis, cargos automaticos, automod, logs, musica, votacoes e integracao com OpenAI em uma arquitetura organizada por comandos, eventos, servicos e configuracoes.
</p>

---

## Sumario

- [Visao geral](#visao-geral)
- [Principais recursos](#principais-recursos)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como instalar](#como-instalar)
- [Variaveis de ambiente](#variaveis-de-ambiente)
- [Scripts](#scripts)
- [CI no GitHub Actions](#ci-no-github-actions)
- [Comandos do bot](#comandos-do-bot)
- [Sistema de XP e niveis](#sistema-de-xp-e-niveis)
- [Cargos automaticos](#cargos-automaticos)
- [Automod](#automod)
- [Sistema de musica](#sistema-de-musica)
- [Logs do servidor](#logs-do-servidor)
- [Permissoes e intents](#permissoes-e-intents)
- [Checklist de configuracao](#checklist-de-configuracao)
- [Boas praticas de seguranca](#boas-praticas-de-seguranca)
- [Troubleshooting](#troubleshooting)

---

## Visao geral

Este projeto e um bot Discord construido com foco em modularidade e evolucao. Cada responsabilidade vive em um lugar claro:

- comandos em `src/commands`;
- eventos em `src/events`;
- regras de negocio em `src/services`;
- configuracoes em `src/config`;
- utilitarios em `src/utils`;
- tipos compartilhados em `src/types`;
- dados locais em `src/data`.

O bot registra comandos slash automaticamente, responde a eventos do servidor, controla XP e cargos por nivel, aplica moderacao automatica, registra logs organizados e toca musicas do YouTube em canais de voz.

---

## Principais recursos

| Area | Recursos |
| --- | --- |
| Moderacao | `/kick`, `/ban`, `/timeout`, `/clear`, validacao de permissao, hierarquia e owner |
| Informacoes | `/serverinfo`, `/userinfo`, `/ping` |
| XP e niveis | XP por mensagem, cooldown anti-spam, rank individual, top 10, comandos owner para ajuste manual |
| Cargos | cargos acumulativos por nivel, cargo MAX com aprovacao, cargo superior solicitado no chat |
| Automod | lista local, OpenAI Moderation API, tolerancia por cargo, usuarios/cargos imunes e punicoes automaticas |
| Logs | mensagens, edicoes, delecoes, voz, XP, level up e automod em canal configurado |
| Musica | `/music`, fila por servidor, YouTube, volume, loop, pausa, resume, votacoes e saida automatica |
| OpenAI | `/ask` preparado com Responses API, atualmente mantido desabilitado para evitar custos |

---

## Tecnologias

- **Node.js**
- **TypeScript**
- **discord.js v14**
- **@discordjs/voice**
- **OpenAI SDK**
- **OpenAI Moderation API**
- **dotenv**
- **tsx**
- **ffmpeg-static**
- **youtube-dl-exec / yt-dlp**
- **play-dl**
- **@distube/ytdl-core**

---

## Estrutura do projeto

```text
discord-agent-bot/
├─ src/
│  ├─ commands/
│  │  ├─ ask.ts
│  │  ├─ automod.ts
│  │  ├─ ban.ts
│  │  ├─ cargo.ts
│  │  ├─ clear.ts
│  │  ├─ kick.ts
│  │  ├─ leaderboard.ts
│  │  ├─ music.ts
│  │  ├─ ping.ts
│  │  ├─ rank.ts
│  │  ├─ serverinfo.ts
│  │  ├─ timeout.ts
│  │  ├─ userinfo.ts
│  │  └─ xp.ts
│  ├─ config/
│  │  ├─ automod.config.ts
│  │  ├─ env.ts
│  │  └─ level.config.ts
│  ├─ data/
│  │  └─ levels.json
│  ├─ events/
│  │  ├─ interactionCreate.ts
│  │  ├─ messageCreate.ts
│  │  ├─ messageDelete.ts
│  │  ├─ messageUpdate.ts
│  │  ├─ ready.ts
│  │  └─ voiceStateUpdate.ts
│  ├─ services/
│  │  ├─ automod.service.ts
│  │  ├─ commandLoader.ts
│  │  ├─ eventLoader.ts
│  │  ├─ level.service.ts
│  │  ├─ log.service.ts
│  │  ├─ music.service.ts
│  │  ├─ openai-moderation.service.ts
│  │  ├─ openai.service.ts
│  │  └─ registerCommands.ts
│  ├─ types/
│  │  ├─ Command.ts
│  │  └─ music.types.ts
│  ├─ utils/
│  │  ├─ automod.util.ts
│  │  └─ permission.util.ts
│  └─ index.ts
├─ .env.example
├─ package.json
├─ package-lock.json
├─ tsconfig.json
└─ README.md
```

---

## Como instalar

### 1. Clone o projeto

```bash
git clone <url-do-repositorio>
cd discord-agent-bot
```

### 2. Instale as dependencias

```bash
npm install
```

### 3. Configure o `.env`

Crie um arquivo `.env` na raiz com base no `.env.example`.

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 4. Rode em desenvolvimento

```bash
npm run dev
```

### 5. Gere build de producao

```bash
npm run build
npm start
```

---

## Variaveis de ambiente

Exemplo seguro:

```env
DISCORD_TOKEN=COLOQUE_AQUI_O_TOKEN_DO_BOT
DISCORD_CLIENT_ID=COLOQUE_AQUI_O_CLIENT_ID
DISCORD_GUILD_ID=COLOQUE_AQUI_O_ID_DO_SERVIDOR_DE_TESTE
BOT_INTERACTION_CHANNEL_ID=COLOQUE_AQUI_O_ID_DO_CANAL_DE_COMANDOS
LEVELS_FILE_PATH=src/data/levels.json

OPENAI_API_KEY=COLOQUE_AQUI_SUA_CHAVE_OPENAI
OPENAI_MODEL=gpt-4.1-mini
OPENAI_MODERATION_MODEL=omni-moderation-latest
```

| Variavel | Obrigatoria | Uso |
| --- | --- | --- |
| `DISCORD_TOKEN` | Sim | Token usado para logar o bot |
| `DISCORD_CLIENT_ID` | Sim | ID da aplicacao no Discord Developer Portal |
| `DISCORD_GUILD_ID` | Recomendado | Registra comandos rapidamente em um servidor especifico |
| `BOT_INTERACTION_CHANNEL_ID` | Opcional | Canal exclusivo para comandos de usuarios comuns; o owner pode usar comandos em qualquer canal |
| `LEVELS_FILE_PATH` | Opcional | Caminho do arquivo JSON usado como banco de XP; no Docker use `/app/data/levels.json` |
| `OPENAI_API_KEY` | Apenas automod/OpenAI | Chave usada pela OpenAI Moderation API e pelo `/ask` |
| `OPENAI_MODEL` | Opcional | Modelo usado pelo servico OpenAI de perguntas |
| `OPENAI_MODERATION_MODEL` | Opcional | Modelo de moderacao, padrao `omni-moderation-latest` |

> Nunca publique o `.env` no GitHub. Tokens vazados devem ser revogados e recriados imediatamente.

---

## Scripts

| Script | Comando | Descricao |
| --- | --- | --- |
| Dev | `npm run dev` | Inicia o bot com `tsx watch` |
| Build | `npm run build` | Compila TypeScript para `dist/` |
| Start | `npm start` | Executa a versao compilada |
| Test | `npm test` | Executa a suite de testes unitarios com Vitest |
| Test Watch | `npm run test:watch` | Executa os testes em modo observacao |

---

## Deploy com Docker

No servidor Proxmox com Docker e Docker Compose instalados:

```bash
git clone https://github.com/GabriellBM/discord-agent-bot.git
cd discord-agent-bot
cp .env.example .env
nano .env
```

Para Docker, mantenha o banco de XP em volume persistente:

```env
LEVELS_FILE_PATH=/app/data/levels.json
```

Suba o bot:

```bash
docker compose up -d --build
```

Ver logs em tempo real:

```bash
docker compose logs -f discord-agent-bot
```

Parar o bot:

```bash
docker compose down
```

Atualizar depois de um novo push:

```bash
git pull
docker compose up -d --build
```

O arquivo `levels.json` fica persistido em `./data/levels.json` no servidor.

---

## CI no GitHub Actions

O projeto possui uma esteira em `.github/workflows/ci.yml`.

Ela roda automaticamente em:

- push para `main`, `develop` e `homolog`;
- pull requests direcionados para `main`, `develop` e `homolog`;
- execucao manual pelo botao **Run workflow** no GitHub Actions.

Checks executados:

| Job | O que valida |
| --- | --- |
| `Repository Safety` | Garante que `.env`, `src/data/levels.json`, `dist` e `node_modules` nao foram versionados e valida arquivos essenciais |
| `Secret Scan` | Procura padroes comuns de tokens do Discord, chaves OpenAI e outros segredos em arquivos rastreados |
| `Environment Contract` | Confere se `.env.example` possui as variaveis obrigatorias e nao contem segredos reais |
| `Dependency Audit` | Instala dependencias com `npm ci` e roda `npm audit --omit=dev --audit-level=high` |
| `Typecheck Node 22/24` | Executa `npm run typecheck` em matriz com Node.js 22 e 24 |
| `Unit Tests Node 22/24` | Executa `npm test` em matriz com Node.js 22 e 24 |
| `Production Build` | Compila com `npm run build` no Node.js 24 e publica `dist/` como artefato temporario |

Essa esteira ajuda a impedir que dados sensiveis ou arquivos runtime entrem no repositorio, valida o contrato de ambiente, checa dependencias vulneraveis e confirma que o bot continua compilando antes de integrar mudancas.

---

## Comandos do bot

### Utilitarios

| Comando | Descricao |
| --- | --- |
| `/ping` | Testa se o bot esta respondendo |
| `/serverinfo` | Mostra nome, total de membros e criacao do servidor |
| `/userinfo usuario` | Mostra nome, ID, entrada no servidor e cargos do usuario |

### Moderacao

| Comando | Permissao | Descricao |
| --- | --- | --- |
| `/kick usuario motivo` | `KickMembers` | Expulsa um usuario do servidor |
| `/ban usuario motivo` | `BanMembers` | Bane um usuario do servidor |
| `/timeout usuario minutos motivo` | `ModerateMembers` | Silencia temporariamente um usuario |
| `/clear quantidade` | `ManageMessages` | Apaga mensagens, com limite maximo de 100 |

Os comandos de moderacao validam:

- permissao do usuario;
- permissao do bot;
- hierarquia de cargos;
- protecao contra acoes no owner;
- `kickable`, `bannable` e `moderatable`;
- respostas administrativas privadas.

### XP e ranking

| Comando | Quem pode usar | Descricao |
| --- | --- | --- |
| `/rank` | Todos | Mostra seu nivel, XP e mensagens |
| `/rank usuario` | Todos | Consulta o rank de outro usuario |
| `/top10` | Todos | Mostra o top 10 de XP do servidor |
| `/xp add usuario quantidade motivo` | Owner | Adiciona XP manualmente |
| `/xp remove usuario quantidade motivo` | Owner | Remove XP manualmente |
| `/xp set usuario quantidade motivo` | Owner | Define o XP atual de um usuario |
| `/xp reset usuario motivo` | Owner | Reseta XP, nivel e mensagens |
| `/xp sync usuario` | Owner | Sincroniza cargos de level do usuario |

Quando o owner executa `/top10`, a resposta aparece publicamente. Para outros usuarios, a resposta e privada.

### Automod

| Comando | Quem pode usar | Descricao |
| --- | --- | --- |
| `/automod status` | Owner | Mostra status, thresholds, regras e canal de logs |
| `/automod test texto` | Owner | Testa a lista local e a OpenAI Moderation API sem punir |
| `/automod logtest` | Owner | Envia um log de teste no canal configurado |

### Musica

| Comando | Descricao |
| --- | --- |
| `/music play url` | Toca ou adiciona um link do YouTube na fila |
| `/music playlist` | Mostra musica atual, proximas musicas, volume e loop |
| `/music nowplaying` | Mostra detalhes da musica atual |
| `/music pause` | Pausa a musica |
| `/music resume` | Retoma a musica |
| `/music skip force` | Pula musica por votacao ou forca do owner |
| `/music stop force` | Para, limpa a fila e desconecta |
| `/music leave force` | Desconecta o bot do canal |
| `/music volume valor` | Ajusta volume de 1 a 100 |
| `/music loop modo` | Define loop `off`, `track` ou `playlist` |

### Cargo superior

| Comando | Quem pode usar | Descricao |
| --- | --- | --- |
| `/applyleigosenior` | Usuarios com cargo MAX | Solicita ao owner um cargo superior via aprovacao no chat |

### OpenAI

| Comando | Status | Descricao |
| --- | --- | --- |
| `/ask pergunta` | Desabilitado por seguranca de custo | Preparado para usar OpenAI Responses API |

---

## Sistema de XP e niveis

O evento `messageCreate` concede XP automaticamente quando um usuario envia mensagem valida.

Regras atuais:

- bots sao ignorados;
- DMs sao ignoradas;
- cooldown padrao de 60 segundos por usuario;
- XP aleatorio por mensagem entre 10 e 25;
- dados salvos em `src/data/levels.json`;
- total de mensagens tambem e armazenado;
- formula de nivel: `xpNecessario = 100 * nivelAtual`.

Exemplo:

| Nivel atual | XP necessario |
| --- | --- |
| 1 | 100 XP |
| 2 | 200 XP |
| 3 | 300 XP |
| 10 | 1000 XP |
| 50 | 5000 XP |

---

## Cargos automaticos

A configuracao fica em `src/config/level.config.ts`.

```ts
export const LEVEL_ROLES = [
  { level: 5, roleId: "ID_DO_CARGO" },
  { level: 10, roleId: "ID_DO_CARGO" },
  { level: 20, roleId: "ID_DO_CARGO" },
  { level: 30, roleId: "ID_DO_CARGO" }
];
```

Comportamento:

- cargos comuns sao acumulativos;
- o usuario mantem cargos anteriores ao subir de nivel;
- o bot valida se o cargo existe;
- o bot valida `ManageRoles`;
- o bot respeita hierarquia;
- se o usuario perder XP e cair de nivel, cargos acima do nivel atual podem ser removidos;
- cargos fora do sistema de level nunca sao removidos.

### Cargo MAX

```ts
export const MAX_LEVEL = 50;

export const MAX_LEVEL_ROLE = {
  roleId: "ID_DO_CARGO_MAX"
};
```

O cargo MAX:

- nao e aplicado automaticamente;
- precisa de aprovacao manual do owner;
- e acumulativo;
- nao remove cargos anteriores;
- nao e removido automaticamente pelo automod.

### Cargo superior ao MAX

```ts
export const HIGHER_THAN_MAX_ROLE = {
  roleId: "ID_DO_CARGO_SUPERIOR"
};
```

Usuarios com cargo MAX podem usar `/applyleigosenior` para solicitar o cargo superior. A aprovacao acontece no chat, com botoes para aprovar ou reprovar.

---

## Automod

O automod tem duas camadas:

1. **Lista local** em `AUTOMOD_CONFIG.forbiddenWords`;
2. **OpenAI Moderation API** como segunda camada quando a lista local nao detecta nada.

Isso reduz chamadas para a API e ajuda a evitar `429 Too Many Requests`.

### Configuracao principal

Arquivo: `src/config/automod.config.ts`

```ts
export const AUTOMOD_CONFIG = {
  enabled: true,
  moderation: {
    enabled: true,
    model: process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest",
    normalThreshold: 0.65,
    severeThreshold: 0.85,
    xpPenalty: 50,
    severeXpPenalty: 100,
    timeoutMinutes: 10,
    severeTimeoutMinutes: 60,
    rateLimitCooldownMs: 60_000,
    minTextLength: 3
  },
  deleteMessage: true,
  logChannelId: "ID_DO_CANAL_DE_LOGS",
  ignoredRoleIds: [],
  ignoredUserIds: [],
  roleToleranceRules: []
};
```

### Imunidades

O automod nunca pune:

- owner do servidor;
- bots;
- usuarios em `ignoredUserIds`;
- membros com cargos em `ignoredRoleIds`.

### Tolerancia por cargo

`roleToleranceRules` permite reduzir penalidade para cargos especificos.

Exemplo:

```ts
roleToleranceRules: [
  {
    roleId: "ID_DO_CARGO",
    xpPenalty: 10,
    timeoutMinutes: 0,
    deleteMessage: true
  }
]
```

### Rate limit da OpenAI

Se a OpenAI retornar `429`, o bot:

- entra em cooldown temporario;
- nao chama a API repetidamente;
- nao pune usuarios quando a API falha;
- evita spam no console.

---

## Sistema de musica

O sistema de musica usa `@discordjs/voice` e `yt-dlp` para transmitir audio sem baixar arquivos locais permanentes.

Recursos:

- fila por servidor;
- links do YouTube;
- titulo real do video;
- duracao quando disponivel;
- volume padrao de 5%;
- volume ajustavel;
- loop de faixa;
- loop de playlist;
- pausa e retomada;
- votacoes para `skip`, `stop` e `leave`;
- owner pode usar `force:true`;
- saida automatica quando a fila acaba;
- saida automatica quando o bot fica sozinho no canal de voz.

### Votacoes

Acoes sensiveis usam maioria simples:

```text
votos necessarios = floor(totalHumanos / 2) + 1
```

Podem votar apenas usuarios humanos no mesmo canal de voz.

### Inatividade

O bot desconecta automaticamente quando:

- a playlist termina e nao ha novas musicas por 30 segundos;
- nao ha mais nenhum usuario humano no canal por 30 segundos.

---

## Logs do servidor

O bot registra atividades no canal configurado em `AUTOMOD_CONFIG.logChannelId`.

Eventos cobertos:

- mensagens enviadas;
- mensagens editadas;
- mensagens deletadas;
- entrada, saida e movimentacao em canais de voz;
- mute/surdez/camera/stream em voz;
- XP ganho;
- alteracoes manuais de XP;
- level up;
- automod;
- testes de log.

Se o canal nao existir ou o bot nao tiver permissao para enviar mensagens, ele registra erro no console e continua rodando.

---

## Permissoes e intents

### Intents usadas

Configuradas em `src/index.ts`:

```ts
GatewayIntentBits.Guilds
GatewayIntentBits.GuildMessages
GatewayIntentBits.GuildMembers
GatewayIntentBits.GuildVoiceStates
GatewayIntentBits.MessageContent
```

### Permissoes recomendadas para o bot

- View Channels;
- Send Messages;
- Embed Links;
- Read Message History;
- Manage Messages;
- Kick Members;
- Ban Members;
- Moderate Members;
- Manage Roles;
- Connect;
- Speak;
- Use Voice Activity.

Para cargos automaticos, o cargo do bot precisa estar acima dos cargos que ele deve aplicar/remover.

---

## Checklist de configuracao

Antes de rodar em servidor real:

- [ ] Criar aplicacao no Discord Developer Portal;
- [ ] Criar bot e copiar token;
- [ ] Ativar intents privilegiadas necessarias;
- [ ] Preencher `.env`;
- [ ] Configurar `DISCORD_CLIENT_ID`;
- [ ] Configurar `DISCORD_GUILD_ID` durante testes;
- [ ] Configurar IDs de cargos em `level.config.ts`;
- [ ] Configurar canal de logs em `automod.config.ts`;
- [ ] Configurar cargos/usuarios imunes do automod;
- [ ] Colocar o cargo do bot acima dos cargos gerenciados;
- [ ] Rodar `npm run build`;
- [ ] Iniciar com `npm run dev` ou `npm start`;
- [ ] Testar `/ping`;
- [ ] Testar `/automod logtest`;
- [ ] Testar `/rank`, `/top10` e `/music play`.

---

## Boas praticas de seguranca

- Nunca commitar `.env`;
- Nunca postar token do Discord em chats publicos;
- Revogar imediatamente tokens vazados;
- Usar `DISCORD_GUILD_ID` em desenvolvimento para registrar comandos mais rapido;
- Manter comandos de XP restritos ao owner;
- Revisar `forbiddenWords` para evitar falsos positivos;
- Monitorar custos da OpenAI;
- Manter o bot com o minimo de permissoes necessario;
- Separar canal de logs privado para moderadores/owner.

---

## Troubleshooting

### Comandos slash nao aparecem

- Confirme `DISCORD_CLIENT_ID`;
- Confirme `DISCORD_GUILD_ID`;
- Reinicie o bot;
- Comandos globais podem demorar mais para aparecer.

### O bot nao aplica cargo

- Verifique se o `roleId` esta correto;
- Verifique se o bot tem `ManageRoles`;
- Verifique se o cargo do bot esta acima do cargo de level;
- Verifique se o cargo existe no servidor.

### Automod retorna `429 Too Many Requests`

- A lista local reduz chamadas para a API;
- O bot aplica cooldown automatico;
- Considere aumentar `minTextLength`;
- Considere ampliar `forbiddenWords`;
- Verifique limites e billing da OpenAI.

### Musica nao toca

- Verifique se o bot tem permissao para conectar e falar;
- Teste outro link do YouTube;
- Evite videos privados, restritos ou indisponiveis;
- Reinicie o bot apos instalar dependencias;
- Confirme que `npm install` instalou `youtube-dl-exec`, `ffmpeg-static` e `opusscript`.

### Bot nao sai da call

- Ele sai quando a fila acaba e fica 30 segundos inativo;
- Ele tambem sai se ficar 30 segundos sozinho no canal de voz;
- Se houver outro bot na sala, ele nao conta como humano.

---

## Licenca

Este projeto esta configurado como **MIT** no `package.json`.

---

<p align="center">
  Feito para ser modular, seguro e facil de evoluir.
</p>
