import { VariablePart } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { ethers } from "ethers";
import { ABI } from "../lib/abi"
import { ethers as hEthers} from "hardhat";
import * as contract from "../artifacts/contracts/MyWord.sol/MyWord.json";
import { MyWord__factory } from "../typechain"
import type { MyWord } from "../typechain"
import { Draw, Shuffle } from "../generated/MyWord";

describe("MyWord", function () {
  let deployedContract: MyWord
  let abi: ABI;
  before(async () => {
    const contractFactory = new MyWord__factory((await hEthers.getSigners())[0]);
    deployedContract = await contractFactory.deploy();
    await deployedContract.deployed();
    abi = new ABI(new ethers.utils.Interface(contract.abi))
  })

  // no outcome encode
  let encode = (state):VariablePart => {
    return {
      outcome: hEthers.constants.HashZero,
      appData: abi.encodeStruct(state),
    }
  }
  let encodeGenericStruct = (kind):VariablePart => {
    return {
      outcome: hEthers.constants.HashZero,
      appData: abi.encodeGenericStruct(kind),
    }
  }


  it("Should not allow invalid state kinds/pairings", async () => {
    await expect(deployedContract.validTransitionTestable(encodeGenericStruct("Draw"), encodeGenericStruct("Pair"), 0, 2)).to.be.revertedWith("Invalid state kinds") // jump
    await expect(deployedContract.validTransitionTestable(encodeGenericStruct("Shuffle"), encodeGenericStruct("Draw"), 0, 2)).to.be.revertedWith("Invalid state kinds") // reversed
    await expect(deployedContract.validTransitionTestable(encodeGenericStruct("Jazz"), encodeGenericStruct("AppleTrane"), 0, 2)).to.be.revertedWith("Invalid state kinds") // garbace
  })

  it("Should transition from Draw to Shuffle", async () => {
    let hash = ethers.utils.keccak256(ethers.utils.formatBytes32String("test")) // TODO: hash an actual draw commitment

    let draw = new Draw(hash, {a: 3, b: 4, pot: 5})
    let shuffle = new Shuffle([1,2,3,4,5], hash, {a: 3, b: 4, pot: 5})
    expect(await deployedContract.validTransitionTestable(encode(draw), encode(shuffle), 0, 2)).to.equal(true)
    
    let thiefShuffle = new Shuffle([1,2,3,4,5], hash, {a: 0, b: 7, pot: 5})
    await expect(deployedContract.validTransitionTestable(encode(draw), encode(thiefShuffle), 0, 2)).to.be.revertedWith("Treasuries not equal")
    
    let tamperedHash = ethers.utils.keccak256(ethers.utils.formatBytes32String("sneakily choosen numbers"))
    let tamperingShuffle = new Shuffle([1,2,3,4,5], tamperedHash, {a: 3, b: 4, pot: 5})
    await expect(deployedContract.validTransitionTestable(encode(draw), encode(tamperingShuffle), 0, 2)).to.be.revertedWith("Draw commitment tampered with")
  });
});
