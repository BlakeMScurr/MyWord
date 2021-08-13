// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "openzeppelin4/token/ERC20/presets/ERC20PresetFixedSupply.sol";

contract Iudex is ERC20PresetFixedSupply {
    constructor(address owner) ERC20PresetFixedSupply("Iudex", "IUX", 2**256 - 1, owner) {}
}