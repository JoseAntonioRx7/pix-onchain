/**
 * ⚠️ ATENÇÃO: estas chaves privadas são públicas e amplamente conhecidas.
 * Elas existem SOMENTE para os perfis de teste do Hardhat em ambiente local.
 * NUNCA reutilize estas chaves em mainnet, testnet ou qualquer ambiente com valor real.
 */

export const PROFILES = {
  joao: {
    id: "joao",
    nome: "João",
    papel: "Cliente",
    initials: "J",
    colorClass: "avatar-blue",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  ana: {
    id: "ana",
    nome: "Ana",
    papel: "Mercado",
    initials: "A",
    colorClass: "avatar-green",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
  maria: {
    id: "maria",
    nome: "Maria",
    papel: "Amiga",
    initials: "M",
    colorClass: "avatar-purple",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  },
};

export const PROFILE_IDS = Object.keys(PROFILES);

export function getProfileById(id) {
  return PROFILES[id] ?? null;
}

export function getProfileByAddress(address) {
  if (!address) return null;
  const target = address.toLowerCase();
  return Object.values(PROFILES).find((profile) => profile.address?.toLowerCase() === target) ?? null;
}

export function attachAddresses(wallets) {
  Object.entries(wallets).forEach(([id, wallet]) => {
    if (PROFILES[id]) PROFILES[id].address = wallet.address;
  });
  return PROFILES;
}
