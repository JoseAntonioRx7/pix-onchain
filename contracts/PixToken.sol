// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PixToken
 * @notice Token local que representa Reais digitais na PoC.
 * @dev Possui 2 casas decimais para representar centavos.
 */
contract PixToken is ERC20, Ownable {
    constructor() ERC20("Real Digital", "PXT") Ownable(msg.sender) {}

    /**
     * @notice Retorna a quantidade de casas decimais do token.
     * @return Quantidade de casas decimais, fixada em 2.
     */
    function decimals() public pure override returns (uint8) {
        return 2;
    }

    /**
     * @notice Cria novos tokens para um endereço.
     * @dev Disponível somente ao proprietário, usado pelo deploy/faucet da PoC.
     * @param para Endereço que receberá os tokens.
     * @param valor Quantidade em unidades mínimas do token.
     */
    function mint(address para, uint256 valor) external onlyOwner {
        _mint(para, valor);
    }
}
