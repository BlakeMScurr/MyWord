import * as path from 'path';
import * as fs from 'fs';

import * as tsp from "typescript-parser"
import { ClassDeclaration } from 'typescript-parser';

// Generates typescript classes representing the solidity structs that are used in the ForceMove game
// Typechain was not enough because the actual type of AppData as an argument to ValidTransition is bytes
// so that's all that typechain is able to generate.
// Instead we create utility functions in solidity that accept the structs we need so that they are exposed
// in the ABI and typechain can generate methods with the appropriate types.
// This step simply converts those methods into classes that can easily be called and understood on the client.
async function main () {
    let myWordFilePath = path.join(path.resolve(__dirname, ".."), "typechain","MyWord.d.ts")
    let myWordFile = fs.readFileSync(myWordFilePath, "utf8")

    const parser = new tsp.TypescriptParser();
    const parsed = await parser.parseSource(myWordFile);
    
    let file = template;
    let c = <ClassDeclaration>parsed.declarations[1]
    c.methods.forEach((m) => {
        if (m.name.endsWith("Struct")) {
            // Build and prettify the struct from the type of the method's parameter
            file += `\n\nexport class ${m.name.replace("Struct", "")} ${m.parameters[0].type}`.replace(new RegExp(`^\\    `, 'gm'), '')
        }
    })

    fs.writeFileSync(path.join(path.resolve(__dirname, ".."), "generated", "MyWord.ts"), file)
}

const template = `
// AUTO GENERATED FILE - DO NOT EDIT

import {
    ethers,
    EventFilter,
    Signer,
    BigNumber,
    BigNumberish,
    PopulatedTransaction,
    BaseContract,
    ContractTransaction,
    CallOverrides,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";`

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});

