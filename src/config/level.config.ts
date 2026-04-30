export const LEVEL_CONFIG = {
  cooldownSeconds: 60,
  minXpPerMessage: 10,
  maxXpPerMessage: 25
};

export const MAX_LEVEL = 50;

export const LEVEL_ROLES = [
  // Sistema acumulativo: substitua os roleId abaixo pelos IDs reais dos cargos do seu servidor.
  // Ao atingir um novo nivel, o usuario mantem os cargos anteriores e recebe os novos desbloqueados.
  { level: 5, roleId: "1104052366967316521" },
  { level: 10, roleId: "1104056752556757002" },
  { level: 20, roleId: "1104057641992470529" },
  { level: 30, roleId: "1200301633637203968" }
];

export const MAX_LEVEL_ROLE = {
  // Substitua pelo ID real do cargo maximo. Ele depende de aprovacao manual do owner.
  roleId: "1104059593509838918"
};

export const HIGHER_THAN_MAX_ROLE = {
  // Substitua pelo ID real do cargo superior que usuarios com cargo MAX podem solicitar.
  roleId: "1104060031751688202"
};
