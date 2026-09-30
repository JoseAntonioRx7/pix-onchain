const fs = require("fs");
const path = require("path");

const SALDO_INICIAL = 100_000n; // R$ 1.000,00 com 2 casas decimais

function garantirDiretorio(diretorio) {
  fs.mkdirSync(diretorio, { recursive: true });
}

function escreverJson(caminho, conteudo) {
  fs.writeFileSync(caminho, JSON.stringify(conteudo, null, 2) + "\n", "utf8");
}

function copiarAbi(nomeContrato) {
  const origem = path.join(__dirname, "..", "artifacts", "contracts", `${nomeContrato}.sol`, `${nomeContrato}.json`);
  const destino = path.join(__dirname, "..", "frontend", "src", "contracts", "abis", `${nomeContrato}.json`);

  garantirDiretorio(path.dirname(destino));
  const artifact = JSON.parse(fs.readFileSync(origem, "utf8"));
  escreverJson(destino, artifact.abi);
}

async function main() {
  const [admin, joao, ana, maria] = await ethers.getSigners();

  console.log("\n=== PIX ON-CHAIN | DEPLOY LOCAL ===\n");
  console.log(`Admin : ${admin.address}`);
  console.log(`João  : ${joao.address}`);
  console.log(`Ana   : ${ana.address}`);
  console.log(`Maria : ${maria.address}`);

  const Token = await ethers.getContractFactory("PixToken");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const Registry = await ethers.getContractFactory("PixRegistry");
  const registry = await Registry.deploy(await token.getAddress());
  await registry.waitForDeployment();

  for (const perfil of [joao, ana, maria]) {
    const tx = await token.mint(perfil.address, SALDO_INICIAL);
    await tx.wait();
  }

  const network = await ethers.provider.getNetwork();
  const deployments = {
    chainId: Number(network.chainId),
    token: await token.getAddress(),
    registry: await registry.getAddress(),
  };

  const deploymentPath = path.join(__dirname, "..", "frontend", "src", "contracts", "deployments.json");
  garantirDiretorio(path.dirname(deploymentPath));
  escreverJson(deploymentPath, deployments);

  copiarAbi("PixToken");
  copiarAbi("PixRegistry");

  console.log("\nContratos:");
  console.log(`PixToken   : ${deployments.token}`);
  console.log(`PixRegistry: ${deployments.registry}`);

  console.log("\nSaldos iniciais:");
  for (const [nome, perfil] of [["João", joao], ["Ana", ana], ["Maria", maria]]) {
    const saldo = await token.balanceOf(perfil.address);
    console.log(`${nome.padEnd(5)}: R$ ${ethers.formatUnits(saldo, 2)}`);
  }

  console.log("\nArquivos do frontend atualizados:");
  console.log(`- ${path.relative(path.join(__dirname, ".."), deploymentPath)}`);
  console.log("- frontend/src/contracts/abis/PixToken.json");
  console.log("- frontend/src/contracts/abis/PixRegistry.json");
  console.log("\nDeploy concluído.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Falha no deploy:", error);
    process.exit(1);
  });
