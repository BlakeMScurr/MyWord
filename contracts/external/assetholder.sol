// SPDX-License-Identifier: MIT

// This is just a think wrapper around ERC20AssetHolder to make it visible to typechain

pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;
import "hardhat/console.sol";

import '@statechannels/nitro-protocol/contracts/ERC20AssetHolder.sol';

abstract contract assetholderwrapper is ERC20AssetHolder {}