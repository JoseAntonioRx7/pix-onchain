const ERROR_MESSAGES = {
  ChaveNaoEncontrada: "Essa chave Pix não existe.",
  ChaveJaRegistrada: "Essa chave já está em uso.",
  ChaveInvalida: "A chave precisa ter entre 3 e 64 caracteres.",
  LimiteDeChavesAtingido: "Você já atingiu o limite de 5 chaves.",
  NaoEDonoDaChave: "Você não é o dono desta chave.",
  ValorInvalido: "Informe um valor maior que zero.",
  AutoTransferenciaNaoPermitida: "Você não pode enviar Pix para si mesmo.",
  ERC20InsufficientBalance: "Saldo insuficiente.",
  ERC20InsufficientAllowance: "A autorização do pagamento ainda não está pronta.",
  CALL_EXCEPTION: "Não foi possível concluir a operação.",
  NETWORK_ERROR: "Não foi possível conectar ao node local.",
  UNKNOWN_ERROR: "Não foi possível concluir a operação.",
};

function collectErrorCandidates(error) {
  const candidates = [];
  let current = error;
  const seen = new Set();

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    candidates.push(current);
    current = current.error ?? current.info?.error ?? current.cause;
  }

  return candidates;
}

export function extractContractError(error, interfaces = []) {
  for (const candidate of collectErrorCandidates(error)) {
    for (const iface of interfaces) {
      if (!candidate?.data) continue;
      try {
        const parsed = iface.parseError(candidate.data);
        if (parsed?.name) return parsed.name;
      } catch {
        // Tenta a próxima interface/camada.
      }
    }
  }

  for (const candidate of collectErrorCandidates(error)) {
    if (candidate?.reason && ERROR_MESSAGES[candidate.reason]) return candidate.reason;
    if (candidate?.code && ERROR_MESSAGES[candidate.code]) return candidate.code;
  }

  return null;
}

export function getUserErrorMessage(error, interfaces = []) {
  const name = extractContractError(error, interfaces);
  if (name && ERROR_MESSAGES[name]) return ERROR_MESSAGES[name];

  const message = String(error?.shortMessage ?? error?.message ?? "").toLowerCase();
  if (message.includes("insufficient balance")) return "Saldo insuficiente.";
  if (message.includes("insufficient allowance")) return "A autorização do pagamento ainda não está pronta.";
  if (message.includes("network")) return "Não foi possível conectar ao node local.";

  return ERROR_MESSAGES.UNKNOWN_ERROR;
}
