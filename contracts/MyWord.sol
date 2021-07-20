// SPDX-License-Identifier: MIT
pragma solidity >=0.7.4;
pragma experimental ABIEncoderV2;
import "hardhat/console.sol";

import '@statechannels/nitro-protocol/contracts/interfaces/IForceMoveApp.sol';
import { Util } from "./Util.sol";

/**
 * @dev The MyWord contracts complies with the ForceMoveApp interface and allows all transitions, regardless of the
 * data. Used for testing purposes.
 */
contract MyWord is IForceMoveApp, Util {
    /**
     * @notice Encodes trivial rules.
     * @dev Encodes trivial rules.
     * @return true.
     */
    function validTransition(
        VariablePart memory,
        VariablePart memory,
        uint48, // turnNumB
        uint256 // nParticipants
    ) public override pure returns (bool) {
        return true;
    }

    function validTransitionTestable(
        VariablePart memory from,
        VariablePart memory to,
        uint48, // turnNumB
        uint256 // nParticipants
    ) public view returns (bool) {
        Draw memory draw = decodeDraw(from.appData);
        // Shuffle memory shuffle = shuffleData(from.appData);
        return true;
    }

    // ------------------------------------------------- Game States -------------------------------------------------
    //
    //  - Draw:     Player A commits to 5 cards
    //  - Shuffle:  Player B openly selects 5 shuffles
    //  - Pair:     Player A commits to 2 pairs from the shuffled cards
    //  - Guess:    Player B openly guesses A's card pairs
    //  - Reveal:   Player A reveals their card pairs and updates the treausury
    //
    // NB: there must an odd number of states for A and B to swap roles between rounds

    /** 
     * @title Player A commits to 5 cards
     * @dev Player A gives the hash of 5 integers representing two indices in noun list, and 3 indices in an adjective
       list
     */
    struct Draw {
        bytes32 drawCommitment;
        Treasury treasury;
    }

    /** 
     * @title Player B openly selects 5 shuffles
     * @dev Player B gives 5 integers each representing a shuffle on one of A's cards
     * To find the new card we add A's selection to B's shuffle mod the word list length.
     */
    struct Shuffle {
        uint32[5] shuffles;
        bytes32 drawCommitment;
        Treasury treasury;
    }

    /** 
     * @title Player A commits to 2 pairs from the shuffled cards
     * @dev Player A reveals the jointly selected cards and selects the 2 adjectives that pair best with the nouns.
     * The pairings are represents a 2 non-repeating indices from 0 to 2.
     * The commitment is a salted hash of those pairings.
     */
    struct Pair {
        bytes32 selectionCommitment;
        uint32[5] cards;
        Treasury treasury;
    }

    /** 
     * @title Player B openly guesses A's card pairs
     * @dev Player B's guess at A's card pairs are represented like the pairings: as 2 non-repeating indices from 0 to
     * 2.
     */
    struct Guess {
        uint8[2] guess;
        bytes32 selectionCommitment;
        uint32[5] cards;
        Treasury treasury;
    }

    /** 
     * @title Player A reveals their card pairs and updates the treausury
     */
    struct Reveal {
        uint256 salt;
        uint8[2] selection;
        Treasury treasury;
    }

    /**
     * @title The treasury showing how much is owed to each player
     * @dev The units are internal to the game and do not represent ETH or any ERC20 token etc
     * The starting pot is always a multiple of 4, 12 by default.
     * The actual staked tokens must be a multiple starting pot so it can be divided evenly regardless of the outcome.
     */
    struct Treasury {
        uint8 a;
        uint8 b;
        uint8 pot;
    }

// -------------------------------------------------- Decoders --------------------------------------------------

     /**
     * The DecodeX functions decode structs on chain
     * The XStruct functions expose structs in the ABI
     * TODO: generate precompile
     */
    function decodeDraw(bytes memory appDataBytes) internal pure returns (Draw memory) {return abi.decode(appDataBytes, (Draw));}
    function DrawStruct(Draw memory) public pure {}
    
    function decodeShuffle(bytes memory appDataBytes) internal pure returns (Shuffle memory) { return abi.decode(appDataBytes, (Shuffle));}
    function ShuffleStruct(Shuffle memory) public pure {}

    function decodePair(bytes memory appDataBytes) internal pure returns (Pair memory) { return abi.decode(appDataBytes, (Pair));}
    function PairStruct(Pair memory) public pure {}

    function decodeGuess(bytes memory appDataBytes) internal pure returns (Guess memory) { return abi.decode(appDataBytes, (Guess));}
    function GuessStruct(Guess memory) public pure {}

    function decodeReveal(bytes memory appDataBytes) internal pure returns (Reveal memory) { return abi.decode(appDataBytes, (Reveal));}
    function RevealStruct(Reveal memory) public pure {}

}