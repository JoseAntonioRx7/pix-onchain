import { ethers } from "ethers";
import { TOKEN_DECIMALS } from "./config.js";

export function normalizeKey(value) {
  return value.trim().toLowerCase();
}

export function validateKey(value) {
  const key = normalizeKey(value);
  if (key.length < 3 || key.length > 64) {
    return { valid: false, message: "A chave deve ter entre 3 e 64 caracteres." };
  }
  if (/\s/.test(key)) {
    return { valid: false, message: "A chave não pode conter espaços." };
  }
  return { valid: true, value: key };
}

export function parseBrlAmount(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Informe um valor.");

  const normalized = raw
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Informe um valor monetário válido.");
  }

  return ethers.parseUnits(normalized, TOKEN_DECIMALS);
}

export function formatBrl(units) {
  const number = Number(ethers.formatUnits(units ?? 0n, TOKEN_DECIMALS));
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUnits(units) {
  return ethers.formatUnits(units ?? 0n, TOKEN_DECIMALS);
}

export function shortAddress(address) {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatDate(timestampSeconds) {
  const date = new Date(Number(timestampSeconds) * 1000);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
