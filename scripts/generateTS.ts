import * as path from 'path';
import * as fs from 'fs';

// import * as tsp from "typescript-parser-deluxe"
// import { ClassDeclaration } from 'typescript-parser-deluxe';
import * as tsp from "@typescript-eslint/typescript-estree"
import { ExportNamedDeclaration, ClassDeclaration, MethodDefinition, Identifier, TSTypeAnnotation, TSTypeLiteral, TSPropertySignature } from "@typescript-eslint/types/dist/ast-spec"

// Generates typescript classes representing the solidity structs that are used in the ForceMove game
// Typechain was not enough because the actual type of AppData as an argument to ValidTransition is bytes
// so that's all that typechain is able to generate.
// Instead we create utility functions in solidity that accept the structs we need so that they are exposed
// in the ABI and typechain can generate methods with the appropriate types.
// This step simply converts those methods into classes that can easily be called and understood on the client.
async function main () {
    let myWordFilePath = path.join(path.resolve(__dirname, ".."), "typechain","MyWord.d.ts")
    let myWordFile = fs.readFileSync(myWordFilePath, "utf8")

    
    let file = template;
    
    let parsed = tsp.parse(myWordFile, { range: true });
    let end = <ExportNamedDeclaration>parsed.body.filter((decl) => { return decl.type === "ExportNamedDeclaration" })[0]
    let cd = <ClassDeclaration>end.declaration
    let methods: Array<MethodDefinition> = cd.body.body.filter(classChild => {
        if (classChild.type === "MethodDefinition") {
            let method = <MethodDefinition>classChild;
            let key = <Identifier>method.key
            if (key.name.endsWith("Struct")) {
                return true
            }
        }
        return false
    }).map(method => {
        return <MethodDefinition>method
    });
    methods.forEach(method => {
        let arg0 = method.value.params[0] // arg0 contains the struct we want to convert
        let typeDef = myWordFile.substring(arg0.range[0], arg0.range[1])
        let key = <Identifier>method.key

        let newClass = `export class ${key.name.replace("Struct", "")} ${typeDef.replace("arg0: ", "")}`.replace(new RegExp(`^\\    `, 'gm'), '')

        // add constructor
        let id = <Identifier>arg0
        let tya = <TSTypeAnnotation>id.typeAnnotation
        let tyl = <TSTypeLiteral>tya.typeAnnotation

        let typeSigs = []
        let constructorBodyLines = []
        tyl.members.forEach(member => {
            let propSig = <TSPropertySignature>member
            let psid = <Identifier>propSig.key
            let typeBody =  myWordFile.substring(propSig.typeAnnotation.range[0], propSig.typeAnnotation.range[1]).replace(/[(  )\n\t]/g,'').substring(1)
            typeSigs.push(`${psid.name}: ${typeBody}`)
            constructorBodyLines.push(`this.${psid.name} = ${psid.name}`)
        })

        // Add constructor
        // TODO: make this a whole lot more elegant - surely I can use prettier or something like that
        let constructor = `\n\tconstructor(${typeSigs.join(', ')}) {\n\t\t` + constructorBodyLines.join('\n\t\t') + '\n\t}'
        let lines = newClass.split('\n')
        lines.splice(lines.length-1, 0, constructor)
        file += `\n\n` + lines.join('\n')
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

