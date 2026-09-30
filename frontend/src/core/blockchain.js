import { Contract, JsonRpcProvider, Wallet } from "ethers";
import deployments from "../contracts/deployments.json";
import tokenAbi from "../contracts/abis/PixToken.json";
import registryAbi from "../contracts/abis/PixRegistry.json";
import { MAX_ALLOWANCE, RPC_URL } from "./config.js";
import { PROFILES, attachAddresses } from "../profiles.js";

export const provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: false });

export const tokenInterface = new Contract(deployments.token, tokenAbi, provider).interface;
export const registryInterface = new Contract(deployments.registry, registryAbi, provider).interface;

export function createWallets() {
  const wallets = Object.fromEntries(
    Object.entries(PROFILES).map(([id, profile]) => [id, new Wallet(profile.privateKey, provider)]),
  );
  attachAddresses(wallets);
  return wallets;
}

export function createContracts(wallet) {
  return {
    token: new Contract(deployments.token, tokenAbi, wallet),
    registry: new Contract(deployments.registry, registryAbi, wallet),
  };
}

export async function assertLocalNode() {
  const network = await provider.getNetwork();
  return Number(network.chainId) === Number(deployments.chainId);
}

export async function readAllowance(token, owner) {
  return token.allowance(owner, deployments.registry);
}

export async function ensureApproval(token, owner) {
  const allowance = await readAllowance(token, owner);
  if (allowance >= MAX_ALLOWANCE) return { changed: false, tx: null };

  const tx = await token.approve(deployments.registry, MAX_ALLOWANCE);
  await tx.wait();
  return { changed: true, tx };
}

export async function getProfileBalance(token, address) {
  return token.balanceOf(address);
}

export async function getProfileKeys(registry, address) {
  return registry.chavesDe(address);
}
