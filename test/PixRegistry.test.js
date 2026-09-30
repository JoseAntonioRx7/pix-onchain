const { expect } = require("chai");
const { ethers } = require("hardhat");

const UNIDADES_POR_REAL = 100n;

function reais(valor) {
  return ethers.parseUnits(valor, 2);
}

describe("PixRegistry", function () {
  let token;
  let registry;
  let admin;
  let joao;
  let ana;
  let maria;

  beforeEach(async function () {
    [admin, joao, ana, maria] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("PixToken");
    token = await Token.deploy();
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("PixRegistry");
    registry = await Registry.deploy(await token.getAddress());
    await registry.waitForDeployment();

    for (const perfil of [joao, ana, maria]) {
      await token.mint(perfil.address, reais("1000.00"));
      await token.connect(perfil).approve(await registry.getAddress(), ethers.MaxUint256);
    }
  });

  it("deve ter 2 casas decimais no token", async function () {
    expect(await token.name()).to.equal("Real Digital");
    expect(await token.symbol()).to.equal("PXT");
    expect(await token.decimals()).to.equal(2);
  });

  it("deve registrar uma chave e resolver seu endereço", async function () {
    await expect(registry.connect(ana).registrarChave("mercadoana"))
      .to.emit(registry, "ChaveRegistrada")
      .withArgs(ana.address, "mercadoana");

    expect(await registry.resolverChave("mercadoana")).to.equal(ana.address);
    expect(await registry.resolverChave("inexistente")).to.equal(ethers.ZeroAddress);
    expect(await registry.chavesDe(ana.address)).to.deep.equal(["mercadoana"]);
  });

  it("deve rejeitar chave duplicada", async function () {
    await registry.connect(ana).registrarChave("mercadoana");

    await expect(registry.connect(joao).registrarChave("mercadoana"))
      .to.be.revertedWithCustomError(registry, "ChaveJaRegistrada");
  });

  it("deve transferir por chave, atualizar saldos e emitir evento", async function () {
    await registry.connect(ana).registrarChave("mercadoana");

    await expect(registry.connect(joao).transferirPorChave("mercadoana", reais("25.50")))
      .to.emit(registry, "PixEnviado")
      .withArgs(joao.address, ana.address, "mercadoana", reais("25.50"));

    expect(await token.balanceOf(joao.address)).to.equal(reais("974.50"));
    expect(await token.balanceOf(ana.address)).to.equal(reais("1025.50"));
  });

  it("deve rejeitar chave inexistente", async function () {
    await expect(registry.connect(joao).transferirPorChave("chaveinexistente", reais("5.00")))
      .to.be.revertedWithCustomError(registry, "ChaveNaoEncontrada");
  });

  it("deve rejeitar valor zero", async function () {
    await registry.connect(ana).registrarChave("mercadoana");

    await expect(registry.connect(joao).transferirPorChave("mercadoana", 0))
      .to.be.revertedWithCustomError(registry, "ValorInvalido");
  });

  it("deve rejeitar transferência para si mesmo", async function () {
    await registry.connect(joao).registrarChave("joao123");

    await expect(registry.connect(joao).transferirPorChave("joao123", reais("1.00")))
      .to.be.revertedWithCustomError(registry, "AutoTransferenciaNaoPermitida");
  });

  it("deve rejeitar transferência sem approve", async function () {
    await registry.connect(ana).registrarChave("mercadoana");
    await token.connect(joao).approve(await registry.getAddress(), 0);

    await expect(registry.connect(joao).transferirPorChave("mercadoana", reais("1.00")))
      .to.be.reverted;
  });

  it("deve rejeitar remoção por quem não é dono", async function () {
    await registry.connect(ana).registrarChave("mercadoana");

    await expect(registry.connect(joao).removerChave("mercadoana"))
      .to.be.revertedWithCustomError(registry, "NaoEDonoDaChave");
  });

  it("deve remover a chave corretamente", async function () {
    await registry.connect(ana).registrarChave("mercadoana");
    await registry.connect(ana).registrarChave("ana@teste.com");

    await expect(registry.connect(ana).removerChave("mercadoana"))
      .to.emit(registry, "ChaveRemovida")
      .withArgs(ana.address, "mercadoana");

    expect(await registry.resolverChave("mercadoana")).to.equal(ethers.ZeroAddress);
    expect(await registry.chavesDe(ana.address)).to.deep.equal(["ana@teste.com"]);
  });

  it("deve limitar cada endereço a 5 chaves", async function () {
    const chaves = ["ana01", "ana02", "ana03", "ana04", "ana05"];

    for (const chave of chaves) {
      await registry.connect(ana).registrarChave(chave);
    }

    await expect(registry.connect(ana).registrarChave("ana06"))
      .to.be.revertedWithCustomError(registry, "LimiteDeChavesAtingido");
  });

  it("deve rejeitar chave com tamanho inválido", async function () {
    await expect(registry.connect(ana).registrarChave("ab"))
      .to.be.revertedWithCustomError(registry, "ChaveInvalida");

    await expect(registry.connect(ana).registrarChave("a".repeat(65)))
      .to.be.revertedWithCustomError(registry, "ChaveInvalida");
  });
});
