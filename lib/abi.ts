// abi.ts includes helper functions for interacting with the abi

import { ethers } from "ethers";

interface state {
    kind: string;
}
export class ABI {
    abiInterface: ethers.utils.Interface
    constructor(abiInterface: ethers.utils.Interface) {
        this.abiInterface = abiInterface
    }

    // encodeStruct assumes that there is a trivial public function called struct.kind
    // TODO: that function should be auto generated
    encodeStruct(struct: state) {
        return this.abiInterface._encodeParams(this.abiInterface.getFunction(struct.kind).inputs, [struct])
    }
}
