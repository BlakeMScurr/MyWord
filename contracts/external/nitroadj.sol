// SPDX-License-Identifier: MIT

// This is just a think wrapper around NitroAdjudicator to make it visible to typechain

pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;
import "hardhat/console.sol";

import '@statechannels/nitro-protocol/contracts/NitroAdjudicator.sol';

contract nitroadj is NitroAdjudicator {}