# Pix On-Chain — PoC Local

PoC 100% local de um fluxo de pagamentos P2P inspirado no Pix. A tese é validar uma experiência na qual o usuário informa apenas uma chave amigável — telefone, e-mail ou apelido — sem precisar enxergar endereço hexadecimal, taxa de gás, seed phrase ou popup de carteira.

> **Aviso de segurança:** as chaves privadas usadas pelo frontend são públicas, determinísticas e conhecidas. Elas existem exclusivamente para os perfis locais do Hardhat. **Nunca use essas chaves em mainnet, testnet ou qualquer ambiente com valor real.**

## 1. O que foi implementado

A PoC foi modularizada em três áreas:

- `contracts/`: token local e registry de chaves/transferências.
- `scripts/` + `test/`: deploy reproduzível, publicação dos endereços/ABIs e testes automatizados.
- `frontend/`: dashboard vanilla JavaScript com ethers v6, sem React e sem MetaMask.

O frontend mantém os três perfis sempre visíveis, permite alternar o usuário ativo, cadastra/remover chaves, resolve o destinatário antes do pagamento, faz aprovação automática do Registry, acompanha saldos, lê histórico e apresenta um modo de desenvolvedor recolhido.

## 2. Escopo e fora do escopo

### Incluído

- Blockchain local Hardhat em `127.0.0.1:8545`, chainId `31337`.
- `PixToken` ERC-20 com `decimals() = 2`.
- Saldo inicial de `R$ 1.000,00` para João, Ana e Maria.
- Até 5 chaves por endereço.
- Transferências por chave.
- Erros customizados e mensagens amigáveis em português.
- `nonReentrant` e `SafeERC20` no Registry.
- Aprovação automática de allowance máxima.
- Histórico das últimas 10 transações relevantes ao perfil ativo.
- Atualização de saldos por evento + fallback de 2 segundos.

### Fora do escopo

- Mainnet ou testnet.
- MetaMask/WalletConnect.
- KYC.
- Backend e banco de dados.
- Pix bancário real.
- Upgradeability/proxies.
- Oráculos e cross-chain.

## 3. Stack

| Camada | Tecnologia |
|---|---|
| Contratos | Solidity `0.8.24` |
| Bibliotecas Solidity | OpenZeppelin Contracts `5.6.1` |
| Blockchain local | Hardhat `2.28.4` |
| Tooling Hardhat | `@nomicfoundation/hardhat-toolbox` `6.1.2` |
| Runtime Web3 | ethers `6.17.0` |
| Frontend | Vite `6.4.3` + Rollup WebAssembly + JavaScript vanilla |
| Node.js | 18+; Node 22 é suportado pelo fluxo atual do projeto |

Para Hardhat 2, o pacote atual do toolbox usa a linha `6.1.x`/tag compatível `hh2`; a versão `7.x` não é destinada a Hardhat 2.

## 4. Perfis locais

| Conta Hardhat | Perfil na UI | Papel |
|---|---|---|
| #0 | Admin | Owner do token e deploy/mint; não aparece no seletor |
| #1 | João | Cliente |
| #2 | Ana | Mercado |
| #3 | Maria | Amiga |

As chaves dos três perfis ficam em `frontend/src/profiles.js` por decisão explícita da PoC.

## 5. Arquitetura

```text
pix-onchain/
├── contracts/
│   ├── PixToken.sol
│   └── PixRegistry.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── PixRegistry.test.js
├── hardhat.config.js
├── package.json
├── README.md
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── app.js
        ├── profiles.js
        ├── style.css
        ├── core/
        │   ├── blockchain.js
        │   ├── config.js
        │   ├── errors.js
        │   └── format.js
        ├── state/
        │   └── store.js
        ├── ui/
        │   └── ui.js
        └── contracts/
            ├── deployments.json
            └── abis/
                ├── PixToken.json
                └── PixRegistry.json
```

`deployments.json` e os arquivos em `contracts/abis/` são artefatos de build/deploy. O script sempre os sobrescreve com os endereços e ABIs da execução atual.

## 6. Instalação do zero

### Pré-requisitos

```bash
node --version
npm --version
```

O projeto foi escrito para Node 18+.

### Backend Solidity/Hardhat

Caso esteja criando o projeto manualmente do zero:

```bash
mkdir pix-onchain
cd pix-onchain
npm init -y
npm install --save-dev hardhat@2.28.4 @nomicfoundation/hardhat-toolbox@6.1.2 @openzeppelin/contracts@5.6.1
npm install ethers@6.17.0
```

Depois, coloque os arquivos deste repositório nas pastas indicadas e rode:

```bash
npm install
```

### Frontend

Em outro terminal:

```bash
cd frontend
npm install
```

## 7. Sequência para executar

Abra quatro terminais.

### Terminal 1 — node local

```bash
npx hardhat node
```

O node deve ficar disponível em:

```text
http://127.0.0.1:8545
```

### Terminal 2 — testes

```bash
npx hardhat test
```

Ou, pelo script:

```bash
npm test
```

### Terminal 3 — deploy

Com o node local ainda rodando:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Ou:

```bash
npm run deploy
```

O deploy:

1. Publica `PixToken`.
2. Publica `PixRegistry(token)`.
3. Cria R$ 1.000,00 para João, Ana e Maria.
4. Atualiza `frontend/src/contracts/deployments.json`.
5. Copia as ABIs para `frontend/src/contracts/abis/`.

### Terminal 4 — frontend

```bash
cd frontend
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://127.0.0.1:5173`.

## 8. Contratos

### `PixToken.sol`

`PixToken` herda `ERC20` e `Ownable`. O token é chamado **Real Digital**, símbolo **PXT**, com 2 casas decimais.

A função `mint()` é restrita ao owner e existe para o seed inicial/faucet da PoC.

### `PixRegistry.sol`

O Registry mantém:

```solidity
mapping(bytes32 => address) private _enderecoPorChave;
mapping(address => string[]) private _chavesDoEndereco;
```

A chave é indexada pelo `keccak256(bytes(chave))`.

Funções principais:

```text
registrarChave(chave)
removerChave(chave)
resolverChave(chave)
chavesDe(endereco)
transferirPorChave(chaveDestino, valor)
```

Eventos:

```text
ChaveRegistrada
ChaveRemovida
PixEnviado
```

Erros:

```text
ChaveJaRegistrada
ChaveInvalida
LimiteDeChavesAtingido
NaoEDonoDaChave
ChaveNaoEncontrada
ValorInvalido
AutoTransferenciaNaoPermitida
```

## 9. Decisões de UX importantes

### Sem MetaMask

O frontend usa `JsonRpcProvider` e `Wallet(privateKey, provider)`. Isso é deliberado para a PoC local: nenhuma extensão de carteira aparece.

### Gás invisível

A interface principal não apresenta gás, nonce, chain internals ou hashes.

Essas informações ficam apenas no painel **Modo Desenvolvedor**.

### Approve automático

Como o Registry chama `transferFrom()` em nome do remetente, o perfil ativo é autorizado automaticamente com allowance máxima quando necessário.

O usuário não precisa entender ou executar o passo de `approve`.

### Valores

O contrato usa 2 casas decimais:

```javascript
ethers.parseUnits("25.50", 2)
ethers.formatUnits(saldo, 2)
```

Na UI, o usuário sempre trabalha com Reais.

## 10. Cenário de demonstração

1. Selecione **Ana · Mercado** e cadastre `mercadoana`.
2. Selecione **João · Cliente** e cadastre `+5581999990001`.
3. No João, informe a chave `mercadoana`.
4. Aguarde o preview de destinatário mostrar **Ana · Mercado**.
5. Informe `25,50`.
6. Clique em **Enviar pagamento**.
7. Confira:
   - João: `R$ 974,50`
   - Ana: `R$ 1.025,50`
8. Troque para Ana e confira o histórico com o recebimento de João.
9. Tente `chaveinexistente` e confira a mensagem `Essa chave Pix não existe.`.
10. Tente enviar `5000,00` a uma chave válida e confira `Saldo insuficiente.`.

## 11. Testes automatizados

```bash
npx hardhat test
```

A suíte cobre:

- Casas decimais do token.
- Registro de chave.
- Resolução de chave.
- Chave duplicada.
- Transferência por chave.
- Atualização de saldos.
- Evento `PixEnviado`.
- Chave inexistente.
- Valor zero.
- Auto transferência.
- Transferência sem allowance.
- Remoção por não proprietário.
- Remoção válida.
- Limite de 5 chaves.
- Tamanho inválido de chave.

## 12. Critérios de aceite

- [ ] `npx hardhat test` passa.
- [ ] `npx hardhat node` inicia corretamente.
- [ ] Deploy funciona em `localhost` sem edição manual.
- [ ] Frontend abre sem MetaMask.
- [ ] Nenhum popup de carteira aparece.
- [ ] Endereços hexadecimais não aparecem na tela principal.
- [ ] O cenário de demonstração funciona ponta a ponta.
- [ ] Reiniciar o node e executar o deploy novamente atualiza os artefatos do frontend.

## 13. Troubleshooting

### 1. “Node local não encontrado”

Rode:

```bash
npx hardhat node
```

Depois atualize a página.

### 2. Frontend aponta para contratos antigos depois de reiniciar o node

O estado do node local não é persistente. Sempre execute novamente:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Depois atualize o frontend.

### 3. Allowance insuficiente

Normalmente o frontend corrige isso automaticamente. Se você interrompeu uma transação manualmente, troque o perfil e volte ao perfil anterior ou recarregue a aplicação para executar a preparação novamente.

### 4. Nonce/dupla transação

A interface bloqueia ações enquanto uma transação está pendente. Não abra várias ações do mesmo perfil simultaneamente.

### 5. ABI desatualizada

Não edite a ABI à mão. Execute o deploy novamente para regenerar:

```text
frontend/src/contracts/deployments.json
frontend/src/contracts/abis/PixToken.json
frontend/src/contracts/abis/PixRegistry.json
```

## 14. Próximas evoluções

A PoC agora está pronta para receber incrementos sem misturar responsabilidades. A ordem técnica natural é:

1. QR Code para chave/valor.
2. Chave aleatória.
3. Limites por transação e por dia.
4. Pix agendado.
5. Recibo compartilhável.
6. Meta-transactions/paymaster para patrocínio de gás.
7. Camada de autorização/identidade da ideia maior.
8. Testnet dedicada quando a hipótese local estiver validada.

## 15. Referência da arquitetura original

Este repositório segue a especificação fornecida para a PoC: Solidity 0.8.x + OpenZeppelin 5, Hardhat + ethers v6, node local em `31337`, frontend vanilla, sem MetaMask/backend, com perfis simulados e chaves amigáveis. A implementação também mantém o fluxo de `approve` invisível, os artefatos de deploy para o frontend e o cenário de demonstração proposto.
