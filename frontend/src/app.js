import { Contract } from "ethers";
import deployments from "./contracts/deployments.json";
import tokenAbi from "./contracts/abis/PixToken.json";
import registryAbi from "./contracts/abis/PixRegistry.json";
import { PROFILES, getProfileByAddress, getProfileById } from "./profiles.js";
import {
  assertLocalNode,
  createContracts,
  createWallets,
  provider,
  ensureApproval,
} from "./core/blockchain.js";
import {
  AMOUNT_MIN_UNITS,
  EXPECTED_CHAIN_ID,
  HISTORY_LIMIT,
  MAX_KEYS,
  POLL_INTERVAL_MS,
} from "./core/config.js";
import {
  formatBrl,
  normalizeKey,
  parseBrlAmount,
  validateKey,
} from "./core/format.js";
import { getUserErrorMessage } from "./core/errors.js";
import { createStore } from "./state/store.js";
import * as view from "./ui/ui.js";

const tokenReadOnly = new Contract(deployments.token, tokenAbi, provider);
const registryReadOnly = new Contract(deployments.registry, registryAbi, provider);
const wallets = createWallets();

const store = createStore({
  nodeOnline: false,
  activeId: "joao",
  contracts: null,
  balances: {},
  keys: [],
  history: [],
  busy: false,
  lastTx: "—",
  lastBlock: "—",
});

let eventListenerAttached = false;
let refreshTimer = null;
let recipientResolveTimer = null;

function activeProfile() {
  return getProfileById(store.get().activeId);
}

function activeWallet() {
  return wallets[store.get().activeId];
}

function profileByAddress(address) {
  return getProfileByAddress(address);
}

async function checkNode() {
  try {
    const network = await provider.getNetwork();
    const online = Number(network.chainId) === Number(EXPECTED_CHAIN_ID);
    if (!online) throw new Error("CHAIN_ID");

    store.set({ nodeOnline: true });
    view.setNodeState(true, `Node local ativo · bloco ${await provider.getBlockNumber()}`);
    return true;
  } catch {
    store.set({ nodeOnline: false });
    view.setNodeState(false);
    return false;
  }
}

async function loadBalances() {
  const balances = {};
  for (const [id, wallet] of Object.entries(wallets)) {
    balances[id] = await tokenReadOnly.balanceOf(wallet.address);
  }
  store.set({ balances });

  const state = store.get();
  view.renderActiveProfile(activeProfile(), balances[state.activeId] ?? 0n);
  view.renderBalances(balances, state.activeId);
}

async function loadKeys() {
  const profile = activeProfile();
  const keys = await store.get().contracts.registry.chavesDe(profile.address);
  store.set({ keys });
  view.renderKeys(keys);
}

async function resolveRecipient(showNotFound = false) {
  const raw = view.ui().destinationInput.value;
  const validation = validateKey(raw);
  if (!validation.valid) {
    view.clearRecipient();
    return null;
  }

  try {
    const address = await registryReadOnly.resolverChave(validation.value);
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      if (showNotFound) view.renderRecipientNotFound();
      return null;
    }
    const profile = profileByAddress(address);
    if (profile) view.renderRecipient(profile);
    else view.renderRecipient({ nome: "Destinatário", papel: "Perfil local", initials: "?", colorClass: "avatar-neutral" });
    return address;
  } catch {
    if (showNotFound) view.renderRecipientNotFound();
    return null;
  }
}

function scheduleRecipientResolve() {
  window.clearTimeout(recipientResolveTimer);
  recipientResolveTimer = window.setTimeout(() => resolveRecipient(false), 300);
}

async function loadHistory() {
  const profile = activeProfile();
  const filter = registryReadOnly.filters.PixEnviado();
  const logs = await registryReadOnly.queryFilter(filter);

  const relevant = logs
    .filter((log) => {
      const de = log.args?.de;
      const para = log.args?.para;
      return de?.toLowerCase() === profile.address.toLowerCase() || para?.toLowerCase() === profile.address.toLowerCase();
    })
    .slice(-HISTORY_LIMIT)
    .reverse();

  const blockTimestampCache = new Map();
  const history = [];

  for (const log of relevant) {
    let timestamp = blockTimestampCache.get(log.blockNumber);
    if (timestamp == null) {
      const block = await provider.getBlock(log.blockNumber);
      timestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);
      blockTimestampCache.set(log.blockNumber, timestamp);
    }

    history.push({
      de: log.args.de,
      para: log.args.para,
      chave: log.args.chaveDestino,
      valor: log.args.valor,
      timestamp,
    });
  }

  store.set({ history });
  view.renderHistory(history, profile.address);
}

async function refreshCurrentData({ history = true } = {}) {
  if (!store.get().nodeOnline || !store.get().contracts) return;
  await loadBalances();
  await loadKeys();
  if (history) await loadHistory();
}

async function activateProfile(id) {
  if (!PROFILES[id]) return;

  store.set({ activeId: id });
  const profile = activeProfile();
  const wallet = activeWallet();
  const contracts = createContracts(wallet);
  store.set({ contracts });

  view.ui().profileSelect.value = id;
  view.ui().profileSelect.disabled = true;
  view.setApprovalLoading(true);
  view.setDeveloperData({
    token: deployments.token,
    registry: deployments.registry,
    wallet: wallet.address,
    txHash: store.get().lastTx,
    block: store.get().lastBlock,
  });

  try {
    await ensureApproval(contracts.token, profile.address);
    await refreshCurrentData();
  } catch (error) {
    view.toast("error", getUserErrorMessage(error, [contracts.registry.interface, contracts.token.interface]));
  } finally {
    view.setApprovalLoading(false);
    view.ui().profileSelect.disabled = store.get().busy;
  }
}

async function handleRegisterKey(event) {
  event.preventDefault();
  if (store.get().busy) return;

  const validation = validateKey(view.ui().keyInput.value);
  if (!validation.valid) {
    view.toast("error", validation.message);
    return;
  }

  const currentKeys = store.get().keys;
  if (currentKeys.length >= MAX_KEYS) {
    view.toast("error", "Você já atingiu o limite de 5 chaves.");
    return;
  }

  store.set({ busy: true });
  view.setKeyLoading(true);
  view.ui().profileSelect.disabled = true;
  try {
    const tx = await store.get().contracts.registry.registrarChave(validation.value);
    const receipt = await tx.wait();
    view.ui().devTx.textContent = tx.hash;
    view.toast("success", `Chave ${validation.value} cadastrada com sucesso.`);
    view.ui().keyInput.value = "";
    view.setDeveloperData({ token: deployments.token, registry: deployments.registry, wallet: activeWallet().address, txHash: tx.hash, block: receipt.blockNumber });
    store.set({ lastTx: tx.hash, lastBlock: receipt.blockNumber });
    await refreshCurrentData({ history: false });
  } catch (error) {
    view.toast("error", getUserErrorMessage(error, [store.get().contracts.registry.interface]));
  } finally {
    view.setKeyLoading(false);
    store.set({ busy: false });
    view.ui().profileSelect.disabled = false;
  }
}

async function handleRemoveKey(key) {
  if (store.get().busy) return;
  const decodedKey = decodeURIComponent(key);
  const confirmed = window.confirm(`Remover a chave "${decodedKey}"?`);
  if (!confirmed) return;

  store.set({ busy: true });
  view.ui().profileSelect.disabled = true;
  try {
    const tx = await store.get().contracts.registry.removerChave(decodedKey);
    const receipt = await tx.wait();
    store.set({ lastTx: tx.hash, lastBlock: receipt.blockNumber });
    view.setDeveloperData({ token: deployments.token, registry: deployments.registry, wallet: activeWallet().address, txHash: tx.hash, block: receipt.blockNumber });
    view.toast("success", "Chave removida.");
    await refreshCurrentData({ history: false });
  } catch (error) {
    view.toast("error", getUserErrorMessage(error, [store.get().contracts.registry.interface]));
  } finally {
    store.set({ busy: false });
    view.ui().profileSelect.disabled = false;
  }
}

async function handlePayment(event) {
  event.preventDefault();
  if (store.get().busy) return;

  const keyValidation = validateKey(view.ui().destinationInput.value);
  if (!keyValidation.valid) {
    view.toast("error", keyValidation.message);
    return;
  }

  let amount;
  try {
    amount = parseBrlAmount(view.ui().amountInput.value);
  } catch (error) {
    view.toast("error", error.message);
    return;
  }

  if (amount < AMOUNT_MIN_UNITS) {
    view.toast("error", "Informe um valor maior que zero.");
    return;
  }

  const recipient = await resolveRecipient(true);
  if (!recipient) {
    view.toast("error", "Essa chave Pix não existe.");
    return;
  }

  if (recipient.toLowerCase() === activeWallet().address.toLowerCase()) {
    view.toast("error", "Você não pode enviar Pix para si mesmo.");
    return;
  }

  const balance = store.get().balances[store.get().activeId] ?? (await tokenReadOnly.balanceOf(activeWallet().address));
  if (amount > balance) {
    view.toast("error", "Saldo insuficiente.");
    return;
  }

  store.set({ busy: true });
  view.setPaymentLoading(true);
  view.ui().profileSelect.disabled = true;

  try {
    const tx = await store.get().contracts.registry.transferirPorChave(keyValidation.value, amount);
    const receipt = await tx.wait();
    store.set({ lastTx: tx.hash, lastBlock: receipt.blockNumber });
    view.setDeveloperData({ token: deployments.token, registry: deployments.registry, wallet: activeWallet().address, txHash: tx.hash, block: receipt.blockNumber });
    view.toast("success", `Pagamento de ${formatBrl(amount)} enviado com sucesso.`);
    view.resetPaymentForm();
    await refreshCurrentData();
    view.flashBalance();
  } catch (error) {
    view.toast("error", getUserErrorMessage(error, [store.get().contracts.registry.interface, store.get().contracts.token.interface]));
  } finally {
    view.setPaymentLoading(false);
    store.set({ busy: false });
    view.ui().profileSelect.disabled = false;
  }
}

function attachRealtimeListener() {
  if (eventListenerAttached) return;
  eventListenerAttached = true;

  registryReadOnly.on(registryReadOnly.filters.PixEnviado(), async () => {
    await loadBalances();
    await loadHistory();
    view.flashBalance();
  });
}

function startFallbackPolling() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(async () => {
    if (store.get().busy || !store.get().nodeOnline) return;
    try {
      await loadBalances();
    } catch {
      await checkNode();
    }
  }, POLL_INTERVAL_MS);
}

function wireEvents() {
  const dom = view.ui();

  dom.profileSelect.addEventListener("change", async (event) => {
    await activateProfile(event.target.value);
  });

  dom.keyForm.addEventListener("submit", handleRegisterKey);
  dom.paymentForm.addEventListener("submit", handlePayment);
  dom.destinationInput.addEventListener("input", scheduleRecipientResolve);
  dom.destinationInput.addEventListener("blur", () => resolveRecipient(true));

  dom.keysList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-key]");
    if (!button) return;
    await handleRemoveKey(button.dataset.removeKey);
  });
}

async function initialize() {
  view.setProfileAddressIndex();
  view.setDeveloperData({ token: deployments.token, registry: deployments.registry, wallet: wallets.joao.address });
  wireEvents();

  const online = await checkNode();
  if (!online) return;

  await activateProfile("joao");
  attachRealtimeListener();
  startFallbackPolling();
}

initialize().catch((error) => {
  console.error("Falha inesperada na interface:", error);
  view.toast("error", "Não foi possível inicializar a aplicação local.");
});
