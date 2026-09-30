// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PixRegistry
 * @notice Registro local de chaves amigáveis e transferências P2P por chave.
 */
contract PixRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    mapping(bytes32 => address) private _enderecoPorChave;
    mapping(address => string[]) private _chavesDoEndereco;

    error ChaveJaRegistrada();
    error ChaveInvalida();
    error LimiteDeChavesAtingido();
    error NaoEDonoDaChave();
    error ChaveNaoEncontrada();
    error ValorInvalido();
    error AutoTransferenciaNaoPermitida();

    event ChaveRegistrada(address indexed dono, string chave);
    event ChaveRemovida(address indexed dono, string chave);
    event PixEnviado(address indexed de, address indexed para, string chaveDestino, uint256 valor);

    /**
     * @notice Cria o registro apontando para o token usado nas transferências.
     * @param tokenAddress Endereço do ERC-20 da PoC.
     */
    constructor(address tokenAddress) {
        token = IERC20(tokenAddress);
    }

    /**
     * @notice Registra uma nova chave amigável para o remetente.
     * @param chave Chave normalizada pelo frontend, com 3 a 64 bytes.
     */
    function registrarChave(string calldata chave) external {
        bytes memory dados = bytes(chave);
        if (dados.length < 3 || dados.length > 64) {
            revert ChaveInvalida();
        }

        if (_chavesDoEndereco[msg.sender].length >= 5) {
            revert LimiteDeChavesAtingido();
        }

        bytes32 chaveHash = keccak256(bytes(chave));
        if (_enderecoPorChave[chaveHash] != address(0)) {
            revert ChaveJaRegistrada();
        }

        _enderecoPorChave[chaveHash] = msg.sender;
        _chavesDoEndereco[msg.sender].push(chave);

        emit ChaveRegistrada(msg.sender, chave);
    }

    /**
     * @notice Remove uma chave pertencente ao remetente.
     * @param chave Chave previamente registrada.
     */
    function removerChave(string calldata chave) external {
        bytes32 chaveHash = keccak256(bytes(chave));
        address dono = _enderecoPorChave[chaveHash];

        if (dono != msg.sender) {
            revert NaoEDonoDaChave();
        }

        delete _enderecoPorChave[chaveHash];

        string[] storage chaves = _chavesDoEndereco[msg.sender];
        uint256 tamanho = chaves.length;

        for (uint256 i = 0; i < tamanho; i++) {
            if (keccak256(bytes(chaves[i])) == chaveHash) {
                if (i != tamanho - 1) {
                    chaves[i] = chaves[tamanho - 1];
                }
                chaves.pop();
                break;
            }
        }

        emit ChaveRemovida(msg.sender, chave);
    }

    /**
     * @notice Resolve uma chave amigável para seu endereço.
     * @param chave Chave normalizada a ser consultada.
     * @return endereco Destinatário ou address(0) caso não exista.
     */
    function resolverChave(string calldata chave) external view returns (address endereco) {
        return _enderecoPorChave[keccak256(bytes(chave))];
    }

    /**
     * @notice Retorna as chaves registradas de um endereço.
     * @param dono Endereço que terá as chaves consultadas.
     * @return chaves Lista de chaves amigáveis.
     */
    function chavesDe(address dono) external view returns (string[] memory chaves) {
        return _chavesDoEndereco[dono];
    }

    /**
     * @notice Envia tokens ao dono de uma chave amigável.
     * @dev O chamador precisa ter aprovado o Registry para gastar seu token.
     * @param chaveDestino Chave do destinatário.
     * @param valor Valor em unidades mínimas do token.
     */
    function transferirPorChave(string calldata chaveDestino, uint256 valor) external nonReentrant {
        address destino = _enderecoPorChave[keccak256(bytes(chaveDestino))];

        if (destino == address(0)) {
            revert ChaveNaoEncontrada();
        }
        if (valor == 0) {
            revert ValorInvalido();
        }
        if (destino == msg.sender) {
            revert AutoTransferenciaNaoPermitida();
        }

        token.safeTransferFrom(msg.sender, destino, valor);
        emit PixEnviado(msg.sender, destino, chaveDestino, valor);
    }
}
