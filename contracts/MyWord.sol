// SPDX-License-Identifier: MIT
pragma solidity >=0.7.4;
pragma experimental ABIEncoderV2;
import "hardhat/console.sol";

import '@statechannels/nitro-protocol/contracts/interfaces/IForceMoveApp.sol';
import '@statechannels/nitro-protocol/contracts/Outcome.sol';
import { Util } from "./Util.sol";

/**
 * @dev The MyWord contracts complies with the ForceMoveApp interface and allows all transitions, regardless of the
 * data. Used for testing purposes.
 */
contract MyWord is IForceMoveApp, Util {
    function validTransition(
        VariablePart memory from,
        VariablePart memory to,
        uint48 turnNumTo,
        uint256 // nParticipants
    ) public override pure returns (bool) {
        return true;
    }
    function validTransitionX(
        VariablePart memory from,
        VariablePart memory to,
        uint48 turnNumTo,
        uint256 // nParticipants
    ) public view returns (bool) {
        GenericState memory fromState = abi.decode(from.appData, (GenericState));
        GenericState memory toState = abi.decode(to.appData, (GenericState));
        Outcome.AllocationItem[] memory fromAllocation = extractAllocation(from);
        Outcome.AllocationItem[] memory toAllocation = extractAllocation(to);

        require(fromState.nounListLength == toState.nounListLength, "Noun list altered");
        require(fromState.adjectiveListLength == toState.adjectiveListLength, "Adjective list altered");

        if (toState.treasury.pot >= 2) {
            requireAllocationZeroedAndFlipped(fromAllocation, toAllocation, turnNumTo);
        } else {
            requireTreasuryAllocationConsistency(fromAllocation, toAllocation, toState.treasury);
        }

        if (strEq(fromState.kind, "Draw") && strEq(toState.kind, "Shuffle")) {
            requireValidDrawToShuffle(abi.decode(from.appData, (Draw)), abi.decode(to.appData, (Shuffle)), turnNumTo);
        } else if (strEq(fromState.kind, "Shuffle") && strEq(toState.kind, "Pair")) {
            requireValidShuffleToPair(abi.decode(from.appData, (Shuffle)), abi.decode(to.appData, (Pair)), turnNumTo);
        } else if (strEq(fromState.kind, "Pair") && strEq(toState.kind, "Guess")) {
            requireValidPairToGuess(abi.decode(from.appData, (Pair)), abi.decode(to.appData, (Guess)), turnNumTo);
        } else if (strEq(fromState.kind, "Guess") && strEq(toState.kind, "Reveal")) {
            requireValidGuessToReveal(abi.decode(from.appData, (Guess)), abi.decode(to.appData, (Reveal)), turnNumTo);
        } else if (strEq(fromState.kind, "Reveal") && strEq(toState.kind, "Draw")) {
            requireValidRevealToDraw(abi.decode(from.appData, (Reveal)), abi.decode(to.appData, (Draw)), turnNumTo);
        } else {
            revert("Invalid state kinds");
        }

        return true;
    }
    
    // ------------------------------------------------- Transitions -------------------------------------------------

    function requireValidDrawToShuffle(Draw memory draw, Shuffle memory shuffle, uint48 turnNumTo) internal view {
        requireEqualTreasuries(draw.treasury, shuffle.treasury);
        require(draw.drawCommitment == shuffle.drawCommitment, "Draw commitment tampered with");
    }

    function requireValidShuffleToPair(Shuffle memory shuffle, Pair memory pair, uint48 turnNumTo) internal view {
        requireEqualTreasuries(shuffle.treasury, pair.treasury);
        uint8 i;
        for (i = 0; i < 2; i++) {
            require(shuffle.nounShuffles[i] < pair.nounListLength, "Noun shuffle must be an integer less than the noun list length");
            require(pair.nounDraw[i] < pair.nounListLength, "Noun draw must be an integer less than the noun list length");
            require((shuffle.nounShuffles[i] + pair.nounDraw[i]) % pair.nounListLength == pair.nouns[i], "Selected card must be draw plus shuffle mod list length");
        }
        for (i = 0; i < 3; i++) {
            require(shuffle.adjectiveShuffles[i] < pair.adjectiveListLength, "Adjective shuffle must be an integer less than the adjective list length");
            require(pair.adjectiveDraw[i] < pair.adjectiveListLength, "Adjective draw must be an integer less than the adjective list length");
            require((shuffle.adjectiveShuffles[i] + pair.adjectiveDraw[i]) % pair.adjectiveListLength == pair.adjectives[i], "Selected card must be draw plus shuffle mod list length");
        }
        require(keccak256(abi.encodePacked(pair.nounDraw, pair.adjectiveDraw, pair.salt)) == shuffle.drawCommitment, "Draw reveal invalid");
    }

    function requireValidPairToGuess(Pair memory pair, Guess memory guess, uint48 turnNumTo) internal view {
        requireEqualTreasuries(pair.treasury, guess.treasury);
        require(pair.selectionCommitment == guess.selectionCommitment, "Selection commitment tampered with");
        uint8 i;
        for (i = 0; i < 2; i++) {
            require(pair.nouns[1] == guess.nouns[1], "Drawn nouns altered");
        }
        for (i = 0; i < 3; i++) {
            require(pair.adjectives[i] == guess.adjectives[i], "Drawn adjectives altered");
        }
        require(guess.guess[0] < 3 && guess.guess[1] < 3, "Guess out of range [0, 2]");
    }

    function requireValidGuessToReveal(Guess memory guess, Reveal memory reveal, uint48 turnNumTo) internal view {
        require(keccak256(abi.encodePacked(reveal.selection, reveal.salt)) == guess.selectionCommitment, "Selection reveal invalid");

        uint8 guesserDelta;
        uint8 selectorDelta;

        bool p0 = guess.guess[0] == reveal.selection[0];
        bool p1 = guess.guess[1] == reveal.selection[1];
        if (p0 && p1) {
            guesserDelta++;
            selectorDelta++;
        } else if ((p0 && !p1) || (!p0 && p1)) {
            selectorDelta+= 2;
        }
        guess.treasury.pot -= 2;

        // If A is the revealer then they're also the selector and should get the selector delta and vice versa
        if (latestTurnIsPlayerA(turnNumTo)) {
            guess.treasury.a += selectorDelta;
            guess.treasury.b += guesserDelta;
        } else {
            guess.treasury.a += guesserDelta;
            guess.treasury.b += selectorDelta;
        }
        requireEqualTreasuries(guess.treasury, reveal.treasury);
    }

    function requireValidRevealToDraw(Reveal memory reveal, Draw memory draw, uint48 turnNumTo) internal view {
        requireEqualTreasuries(reveal.treasury, draw.treasury);
        require(draw.treasury.pot >= 2, "Can't start a new round with less than 2 coins in the pot");
    }

    // ------------------------------------------------- Utilities -------------------------------------------------

    function requireEqualTreasuries(Treasury memory t1, Treasury memory t2) internal view {
        require(
            t1.a == t2.a &&
            t1.b == t2.b &&
            t1.pot == t2.pot,
        'Treasuries not equal');
    }

    function requireTreasuryAllocationConsistency(Outcome.AllocationItem[] memory fromAlloc, Outcome.AllocationItem[] memory toAlloc, Treasury memory treasury) internal view {
        uint256 sum = fromAlloc[0].amount + fromAlloc[1].amount;
        require((treasury.a * sum)/12 == toAlloc[0].amount, "Player A got the wrong allocation");
        require((treasury.b * sum)/12 == toAlloc[1].amount, "Player B got the wrong allocation");
    }

    function requireAllocationZeroedAndFlipped(Outcome.AllocationItem[] memory from, Outcome.AllocationItem[] memory to, uint48 turnNumTo) internal view {
        require(from[0].destination == to[0].destination, "Destination for player A may not change");
        require(from[1].destination == to[1].destination, "Destination for player B may not change");

        require(from[0].amount == to[1].amount, "Allocations not flipped");
        require(from[1].amount == to[0].amount, "Allocations not flipped");
        if (latestTurnIsPlayerA(turnNumTo)) {
            require(to[1].amount == 0, "Player B must have nothing in the allocation to incentivise them to play their next turn");
        } else {
            require(to[0].amount == 0, "Player A must have nothing in the allocation to incentivise them to play their next turn");
        }
    }

    function latestTurnIsPlayerA(uint48 turnNumTo) internal view returns(bool) {
        return turnNumTo % 2 == 0;
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
        uint32 nounListLength;
        uint32 adjectiveListLength;
        Treasury treasury;

        // newly made
        bytes32 drawCommitment;
    }

    /** 
     * @title Player B openly selects 5 shuffles
     * @dev Player B gives 5 integers each representing a shuffle on one of A's cards
     * To find the new card we add A's selection to B's shuffle mod the word list length.
     */
    struct Shuffle {
        string kind;
        uint32 nounListLength;
        uint32 adjectiveListLength;
        Treasury treasury;

        // newly made
        uint32[2] nounShuffles;
        uint32[3] adjectiveShuffles;

        // passed through
        bytes32 drawCommitment;

    }

    /** 
     * @title Player A commits to 2 pairs from the shuffled cards
     * @dev Player A reveals the jointly selected cards and selects the 2 adjectives that pair best with the nouns.
     * The pairings are represents a 2 non-repeating indices from 0 to 2.
     * The commitment is a salted hash of those pairings.
     */
    struct Pair {
        string kind;
        uint32 nounListLength;
        uint32 adjectiveListLength;
        Treasury treasury;

        // newly generated
        bytes32 selectionCommitment;

        // calculated
        uint32[2] nouns;
        uint32[3] adjectives;

        // revealed
        uint32[2] nounDraw;
        uint32[3] adjectiveDraw;
        uint256 salt;
    }

    /** 
     * @title Player B openly guesses A's card pairs
     * @dev Player B's guess at A's card pairs are represented like the pairings: as 2 non-repeating indices from 0 to
     * 2.
     */
    struct Guess {
        string kind;
        uint32 nounListLength;
        uint32 adjectiveListLength;
        Treasury treasury;

        // newly generated
        uint8[2] guess;

        // passed through
        bytes32 selectionCommitment;
        uint32[2] nouns;
        uint32[3] adjectives;
    }

    /** 
     * @title Player A reveals their card pairs and updates the treausury
     */
    struct Reveal {
        string kind;
        uint32 nounListLength;
        uint32 adjectiveListLength;
        Treasury treasury;

        // calculated
        uint8[2] selection;

        // revealed
        uint256 salt;
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

    // --------------------------------------------------- Interface ---------------------------------------------------

    function extractAllocation(VariablePart memory variablePart) private view returns (Outcome.AllocationItem[] memory) {
        Outcome.OutcomeItem[] memory outcome = abi.decode(variablePart.outcome, (Outcome.OutcomeItem[]));
        require(outcome.length == 1, 'Only one asset allowed');
        Outcome.AssetOutcome memory assetOutcome = abi.decode(outcome[0].assetOutcomeBytes, (Outcome.AssetOutcome));
        require(assetOutcome.assetOutcomeType == uint8(Outcome.AssetOutcomeType.Allocation), 'AssetOutcomeType must be Allocation');
        Outcome.AllocationItem[] memory allocation = abi.decode(assetOutcome.allocationOrGuaranteeBytes, (Outcome.AllocationItem[]));
        require(allocation.length == 2, 'Allocation length must equal number of participants (i.e. 2)');
        return allocation;
    }

    /**
     * GenericState allows us distinguish between any state kind, so long as `kind` is the first parameter defined in any struct definition
     */
    struct GenericState {
        string kind;
        uint32 nounListLength;
        uint32 adjectiveListLength;
        Treasury treasury;
    }

    function GenericStateInterface(GenericState memory) public view {}

    // --------------------------------------------------- Decoders ---------------------------------------------------


     /**
     * The XStruct functions expose structs in the ABI
     * TODO: use the requireValidXtoY functions instead
     */
    function DrawStruct(Draw memory) public view {}
    function ShuffleStruct(Shuffle memory) public view {}
    function PairStruct(Pair memory) public view {}
    function GuessStruct(Guess memory) public view {}
    function RevealStruct(Reveal memory) public view {}
}