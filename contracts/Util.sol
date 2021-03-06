// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

contract Util {
    // from https://ethereum.stackexchange.com/a/59335
    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    function strEq(string memory arg, string memory k) internal pure returns (bool){
        return keccak256(bytes(arg)) == keccak256(bytes(k));
    }
}