// SPDX-License-Identifier: MIT
pragma solidity >=0.7.4;
pragma experimental ABIEncoderV2;

import '@statechannels/nitro-protocol/contracts/interfaces/IForceMoveApp.sol';

/**
 * @dev The MyWord contracts complies with the ForceMoveApp interface and allows all transitions, regardless of the data. Used for testing purposes.
 */
contract MyWord is IForceMoveApp {
    /**
     * @notice Encodes trivial rules.
     * @dev Encodes trivial rules.
     * @return true.
     */
    function validTransition(
        VariablePart memory a,
        VariablePart memory a,
        uint48, // turnNumB
        uint256 // nParticipants
    ) public override pure returns (bool) {
        return true;
    }


    // Commit Draw, Open Draw, Reveal Draw
    // Commit Selection, Guess, Reveal Selection

    /**
     * @title 
     */
    struct CommitDraw {

    }

    /**
     * @title The treasury showing how much is owed to each player
     * @dev The amount burned can be calculated from the 
     */
    struct Treasury {
        uint8 a;
        uint8 b;
        uint8 pot;
    }
}