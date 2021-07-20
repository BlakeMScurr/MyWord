// abi.ts includes helper functions for interacting with the abi

import { ethers } from "ethers";

export class ABI {
    abiInterface: ethers.utils.Interface
    constructor(abiInterface: ethers.utils.Interface) {
        this.abiInterface = abiInterface
    }

    // encodeStruct assumes that there is a trivial public function called `structName` + "Struct"
    // TODO: that function should be auto generated
    encodeStruct(functionName: string, values: any) {
        return this.abiInterface._encodeParams(this.abiInterface.getFunction(functionName + "Struct").inputs, [values])
    }
}
