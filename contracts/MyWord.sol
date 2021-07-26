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
    uint32 nounListLength;
    uint32 adjectiveListLength;
    constructor() public {
        nounListLength = 1000;
        adjectiveListLength = 2000;
    }

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
        string memory fromKind = kind(from.appData);
        string memory toKind = kind(to.appData);

        if (strEq(fromKind, "Draw") && strEq(toKind, "Shuffle")) {
            Draw memory draw = decodeDraw(from.appData);
            Shuffle memory shuffle = decodeShuffle(to.appData);

            requireEqualTreasuries(draw.treasury, shuffle.treasury);
            require(draw.drawCommitment == shuffle.drawCommitment, "Draw commitment tampered with");
        } else if (strEq(fromKind, "Shuffle") && strEq(toKind, "Pair")) {
            Shuffle memory shuffle = decodeShuffle(from.appData);
            Pair memory pair = decodePair(to.appData);

            requireEqualTreasuries(shuffle.treasury, pair.treasury);
            uint8 i;
            for (i = 0; i < 2; i++) {
                require(shuffle.nounShuffles[i] < nounListLength, "Noun shuffle must be an integer less than the noun list length");
                require(pair.nounDraw[i] < nounListLength, "Noun draw must be an integer less than the noun list length");
                require((shuffle.nounShuffles[i] + pair.nounDraw[i]) % nounListLength == pair.nouns[i], "Selected card must be draw plus shuffle mod list length");
            }
            for (i = 0; i < 3; i++) {
                require(shuffle.adjectiveShuffles[i] < adjectiveListLength, "Adjective shuffle must be an integer less than the adjective list length");
                require(pair.adjectiveDraw[i] < adjectiveListLength, "Adjective draw must be an integer less than the adjective list length");
                require((shuffle.adjectiveShuffles[i] + pair.adjectiveDraw[i]) % adjectiveListLength == pair.adjectives[i], "Selected card must be draw plus shuffle mod list length");
            }
            require(keccak256(abi.encodePacked(pair.nounDraw, pair.adjectiveDraw, pair.salt)) == shuffle.drawCommitment, "Draw reveal invalid");
        } else if (strEq(fromKind, "Pair") && strEq(toKind, "Guess")) {
        } else if (strEq(fromKind, "Guess") && strEq(toKind, "Reveal")) {
        } else if (strEq(fromKind, "Reveal") && strEq(toKind, "Draw")) {
        } else {
            revert("Invalid state kinds");
        }
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
        string kind;
        bytes32 drawCommitment;
        Treasury treasury;
    }

    /** 
     * @title Player B openly selects 5 shuffles
     * @dev Player B gives 5 integers each representing a shuffle on one of A's cards
     * To find the new card we add A's selection to B's shuffle mod the word list length.
     */
    struct Shuffle {
        string kind;
        uint32[2] nounShuffles;
        uint32[3] adjectiveShuffles;
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
        string kind;
        bytes32 selectionCommitment;
        uint32[2] nounDraw;
        uint32[3] adjectiveDraw;
        uint256 salt;
        uint32[2] nouns;
        uint32[3] adjectives;
        Treasury treasury;
    }

    /** 
     * @title Player B openly guesses A's card pairs
     * @dev Player B's guess at A's card pairs are represented like the pairings: as 2 non-repeating indices from 0 to
     * 2.
     */
    struct Guess {
        string kind;
        uint8[2] guess;
        bytes32 selectionCommitment;
        uint32[5] cards;
        Treasury treasury;
    }

    /** 
     * @title Player A reveals their card pairs and updates the treausury
     */
    struct Reveal {
        string kind;
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

    // ------------------------------------------------- Requirements -------------------------------------------------

    function requireEqualTreasuries(Treasury memory t1, Treasury memory t2) internal pure {
        require(
            t1.a == t2.a &&
            t1.b == t2.b &&
            t1.pot == t2.pot,
        'Treasuries not equal');
    }


    // --------------------------------------------------- Interface ---------------------------------------------------


    /**
     * GenericState allows us distinguish between any state kind, so long as `kind` is the first parameter defined in any struct definition
     */
    struct GenericState {
        string kind;
    }

    function kind(bytes memory appDataBytes) internal pure returns (string memory) {
        return abi.decode(appDataBytes, (GenericState)).kind;
    }
    function GenericStateInterface(GenericState memory) public pure {}

    // --------------------------------------------------- Decoders ---------------------------------------------------


     /**
     * The DecodeX functions decode structs on chain
     * The XStruct functions expose structs in the ABI
     * TODO: generate precompile
     * TODO: move to another file
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