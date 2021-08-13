import { task } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import * as fs from "fs"
import * as path from 'path';
import * as tsp from "@typescript-eslint/typescript-estree"
import { ExportNamedDeclaration, ClassDeclaration, MethodDefinition, Identifier, TSTypeAnnotation, TSTypeLiteral, TSPropertySignature } from "@typescript-eslint/types/dist/ast-spec"


// TODO: it would be nice to hook in with the typechain task, or the artifact task (compile:solidity:emit-artifacts).
// I couldn't get this running after the type generation task triggered by emit-artifacts, and I couldn't get it running
// at all with the typechain task, so for now we'll just use the task that follows, which is a little ugly but hopefully sufficient. 
task("compile:solidity:log:compilation-result").setAction(async (taskArgs, hre, runSuper) => {
  let myWordFilePath = path.join(__dirname, "typechain","MyWord.d.ts")
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
          if (psid.name !== "kind") {
            typeSigs.push(`${psid.name}: ${typeBody}`)
            constructorBodyLines.push(`this.${psid.name} = ${psid.name}`)
          }
      })
      let methodID = <Identifier>method.key
      constructorBodyLines.push(`this.kind = "${methodID.name.replace("Struct", "")}"`)

      // Add constructor
      // TODO: make this a whole lot more elegant - surely I can use prettier or something like that
      let constructor = `\n\tconstructor(${typeSigs.join(', ')}) {\n\t\t` + constructorBodyLines.join('\n\t\t') + '\n\t}'
      let lines = newClass.split('\n')
      lines.splice(lines.length-1, 0, constructor)
      file += `\n\n` + lines.join('\n')
  })
  

  fs.writeFileSync(path.join(__dirname, "generated", "MyWord.ts"), file)
  return runSuper()
});

const template = `
// AUTO GENERATED FILE - DO NOT EDIT

import {
    BigNumberish,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";`

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

export default {
  solidity: {
    compilers: [
        {
          version: "0.8.0",
        },
        {
          version: "0.7.4",
        },
      ],
    },
};