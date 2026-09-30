import { formatBrl, formatDate, shortAddress } from "../core/format.js";
import { PROFILES, PROFILE_IDS } from "../profiles.js";

const elements = {
  nodeBanner: document.querySelector("#node-banner"),
  chainStatus: document.querySelector("#chain-status"),
  chainStatusDetail: document.querySelector("#chain-status-detail"),
  profileSelect: document.querySelector("#profile-select"),
  activeAvatar: document.querySelector("#active-avatar"),
  activeName: document.querySelector("#active-name"),
  activeRole: document.querySelector("#active-role"),
  activeBalance: document.querySelector("#active-balance"),
  approvalStatus: document.querySelector("#approval-status"),
  balancesList: document.querySelector("#balances-list"),
  keyForm: document.querySelector("#key-form"),
  keyInput: document.querySelector("#key-input"),
  keySubmit: document.querySelector("#key-submit"),
  keyCountBadge: document.querySelector("#key-count-badge"),
  keysList: document.querySelector("#keys-list"),
  paymentForm: document.querySelector("#payment-form"),
  destinationInput: document.querySelector("#destination-input"),
  amountInput: document.querySelector("#amount-input"),
  recipientPreview: document.querySelector("#recipient-preview"),
  sendButton: document.querySelector("#send-button"),
  sendSpinner: document.querySelector("#send-spinner"),
  historyList: document.querySelector("#history-list"),
  toastRegion: document.querySelector("#toast-region"),
  devToken: document.querySelector("#dev-token"),
  devRegistry: document.querySelector("#dev-registry"),
  devWallet: document.querySelector("#dev-wallet"),
  devTx: document.querySelector("#dev-tx"),
  devBlock: document.querySelector("#dev-block"),
};

export function ui() {
  return elements;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function setNodeState(online, detail = "") {
  elements.nodeBanner.classList.toggle("hidden", online);
  elements.chainStatus.textContent = online ? "Conectado" : "Offline";
  elements.chainStatusDetail.textContent = online ? detail || "Blockchain local pronta para uso." : "Aguardando o node local.";
}

export function renderActiveProfile(profile, balance) {
  elements.activeAvatar.textContent = profile.initials;
  elements.activeAvatar.className = `avatar large ${profile.colorClass}`;
  elements.activeName.textContent = profile.nome;
  elements.activeRole.textContent = profile.papel;
  elements.activeBalance.textContent = formatBrl(balance);
}

export function renderBalances(balanceMap, activeId) {
  elements.balancesList.innerHTML = PROFILE_IDS.map((id) => {
    const profile = PROFILES[id];
    const balance = balanceMap[id] ?? 0n;
    const activeClass = id === activeId ? " is-active" : "";
    return `
      <div class="mini-balance${activeClass}">
        <div class="mini-balance-person">
          <div class="avatar ${profile.colorClass}">${profile.initials}</div>
          <div><strong>${escapeHtml(profile.nome)}</strong><span>${escapeHtml(profile.papel)}</span></div>
        </div>
        <strong>${formatBrl(balance)}</strong>
      </div>`;
  }).join("");
}

export function renderKeys(keys) {
  elements.keyCountBadge.textContent = `${keys.length}/5`;
  elements.keySubmit.disabled = keys.length >= 5;
  elements.keyInput.disabled = keys.length >= 5;
  elements.keysList.innerHTML = keys.length
    ? keys.map((key) => `
      <div class="key-row">
        <div class="key-icon">⌁</div>
        <div class="key-copy"><strong>${escapeHtml(key)}</strong><span>Chave ativa para recebimento</span></div>
        <button type="button" class="icon-button" data-remove-key="${encodeURIComponent(key)}" aria-label="Remover chave ${escapeHtml(key)}">×</button>
      </div>`).join("")
    : `<div class="empty-state"><strong>Nenhuma chave cadastrada.</strong><span>Crie uma chave para poder receber pagamentos.</span></div>`;
}

export function renderRecipient(profile) {
  if (!profile) {
    elements.recipientPreview.classList.add("hidden");
    return;
  }
  elements.recipientPreview.classList.remove("hidden");
  elements.recipientPreview.innerHTML = `
    <div class="recipient-avatar ${profile.colorClass}">${profile.initials}</div>
    <div><span>Destinatário</span><strong>${escapeHtml(profile.nome)} · ${escapeHtml(profile.papel)}</strong></div>
    <span class="recipient-check">✓</span>`;
}

export function renderRecipientNotFound() {
  elements.recipientPreview.classList.remove("hidden");
  elements.recipientPreview.innerHTML = `
    <div class="recipient-avatar avatar-neutral">?</div>
    <div><span>Destinatário</span><strong class="error-text">Chave não encontrada</strong></div>`;
}

export function clearRecipient() {
  elements.recipientPreview.classList.add("hidden");
  elements.recipientPreview.innerHTML = "";
}

export function renderHistory(items, activeAddress) {
  if (!items.length) {
    elements.historyList.innerHTML = `<div class="empty-state"><strong>Nenhuma transação ainda.</strong><span>Quando um pagamento acontecer, ele aparecerá aqui.</span></div>`;
    return;
  }

  const address = activeAddress.toLowerCase();
  elements.historyList.innerHTML = items.map((item) => {
    const outgoing = item.de.toLowerCase() === address;
    const otherAddress = outgoing ? item.para : item.de;
    const other = PROFILES_BY_ADDRESS.get(otherAddress.toLowerCase());
    const otherLabel = other ? `${other.nome} · ${other.papel}` : shortAddress(otherAddress);
    return `
      <div class="history-row">
        <div class="history-icon ${outgoing ? "outgoing" : "incoming"}">${outgoing ? "↑" : "↓"}</div>
        <div class="history-copy">
          <strong>${outgoing ? "Enviado para" : "Recebido de"} ${escapeHtml(otherLabel)}</strong>
          <span>${escapeHtml(item.chave)} · ${formatDate(item.timestamp)}</span>
        </div>
        <strong class="history-value ${outgoing ? "outgoing-text" : "incoming-text"}">${outgoing ? "−" : "+"}${formatBrl(item.valor)}</strong>
      </div>`;
  }).join("");
}

let PROFILES_BY_ADDRESS = new Map();
export function setProfileAddressIndex() {
  PROFILES_BY_ADDRESS = new Map(
    Object.values(PROFILES)
      .filter((profile) => profile.address)
      .map((profile) => [profile.address.toLowerCase(), profile]),
  );
}

export function setDeveloperData({ token, registry, wallet, txHash = "—", block = "—" }) {
  elements.devToken.textContent = shortAddress(token);
  elements.devRegistry.textContent = shortAddress(registry);
  elements.devWallet.textContent = shortAddress(wallet);
  elements.devTx.textContent = txHash === "—" ? "—" : shortAddress(txHash);
  elements.devBlock.textContent = String(block);
}

export function setApprovalLoading(visible) {
  elements.approvalStatus.classList.toggle("hidden", !visible);
}

export function setPaymentLoading(loading) {
  elements.sendButton.disabled = loading;
  elements.keySubmit.disabled = loading || elements.keySubmit.disabled;
  elements.sendSpinner.classList.toggle("hidden", !loading);
  elements.sendButton.querySelector(".button-label").textContent = loading ? "Enviando…" : "Enviar pagamento";
}

export function setKeyLoading(loading) {
  elements.keySubmit.disabled = loading;
  elements.keySubmit.textContent = loading ? "Cadastrando…" : "Cadastrar chave";
}

export function resetPaymentForm() {
  elements.paymentForm.reset();
  clearRecipient();
}

export function toast(type, message) {
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.innerHTML = `<span class="toast-icon">${type === "success" ? "✓" : "!"}</span><span>${escapeHtml(message)}</span>`;
  elements.toastRegion.appendChild(node);
  window.setTimeout(() => node.remove(), 4200);
}

export function flashBalance(cardSelector = ".mini-balance") {
  document.querySelectorAll(cardSelector).forEach((node) => {
    node.classList.add("balance-flash");
    window.setTimeout(() => node.classList.remove("balance-flash"), 650);
  });
}
