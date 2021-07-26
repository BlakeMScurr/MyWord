import { VariablePart } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { BigNumberish, ethers } from "ethers";
import { ABI } from "../lib/abi"
import { ethers as hEthers} from "hardhat";
import * as contract from "../artifacts/contracts/MyWord.sol/MyWord.json";
import { MyWord__factory } from "../typechain"
import type { MyWord } from "../typechain"
import { Draw, Pair, Shuffle } from "../generated/MyWord";

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

  it("State machine should have limited edges", async () => {
    await expect(deployedContract.validTransitionTestable(encodeGenericStruct("Draw"), encodeGenericStruct("Pair"), 0, 2)).to.be.revertedWith("Invalid state kinds") // jump
    await expect(deployedContract.validTransitionTestable(encodeGenericStruct("Shuffle"), encodeGenericStruct("Draw"), 0, 2)).to.be.revertedWith("Invalid state kinds") // reversed
    await expect(deployedContract.validTransitionTestable(encodeGenericStruct("Jazz"), encodeGenericStruct("AppleTrane"), 0, 2)).to.be.revertedWith("Invalid state kinds") // garbace
  })

  describe("Draw -> Shuffle", () => {
    let commitment = ethers.utils.keccak256(ethers.utils.formatBytes32String("test"))
    let draw = new Draw(commitment, {a: 3, b: 4, pot: 5})

    it("Should allow valid transitions", async () => {
      let shuffle = new Shuffle([1,2], [3,4,5], commitment, {a: 3, b: 4, pot: 5})
      expect(await deployedContract.validTransitionTestable(encode(draw), encode(shuffle), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      let shuffle = new Shuffle([1,2], [3,4,5], commitment, {a: 0, b: 7, pot: 5})
      await expect(deployedContract.validTransitionTestable(encode(draw), encode(shuffle), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should not allow the draw commitment to be tampered with", async () => {
      let tamperedHash = ethers.utils.keccak256(ethers.utils.formatBytes32String("sneakily choosen numbers"))
      let shuffle = new Shuffle([1,2], [3,4,5], tamperedHash, {a: 3, b: 4, pot: 5})
      await expect(deployedContract.validTransitionTestable(encode(draw), encode(shuffle), 0, 2)).to.be.revertedWith("Draw commitment tampered with")
    });
  })

  describe("Shuffle -> Pair", () => {
    let shuffle: Shuffle
    let pair: Pair

    beforeEach(() => {
      let salt = 123456789
      let nounDraw: [BigNumberish, BigNumberish] = [50,999]
      let adjectiveDraw: [BigNumberish, BigNumberish, BigNumberish] = [0, 64, 1999]
  
      let drawCommitment = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([ "tuple(uint32, uint32)", "tuple(uint32, uint32, uint32)", "uint256" ], [nounDraw, adjectiveDraw, salt]))
      shuffle = new Shuffle([69,420], [19, 84, 911], drawCommitment, {a: 3, b: 4, pot: 5})
      pair = new Pair(ethers.constants.HashZero, nounDraw, adjectiveDraw, salt, [119, 419], [19, 148, 910], {a: 3, b: 4, pot: 5})
    })


    it("Should allow valid transitions", async () => {
      expect(await deployedContract.validTransitionTestable(encode(shuffle), encode(pair), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      pair.treasury.a = 7
      pair.treasury.b = 0
      await expect(deployedContract.validTransitionTestable(encode(shuffle), encode(pair), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should provide draws and salt that match the commitment", async () => {
      shuffle.drawCommitment = ethers.constants.HashZero
      await expect(deployedContract.validTransitionTestable(encode(shuffle), encode(pair), 0, 2)).to.be.revertedWith("Draw reveal invalid")
    })

    it("Should calculate the cards correctly based on the draws and shuffles", async () => {
      pair.adjectives[0] = 431
      await expect(deployedContract.validTransitionTestable(encode(shuffle), encode(pair), 0, 2)).to.be.revertedWith("Selected card must be draw plus shuffle mod list length")
    })

    it("Should not allow out of range draws", async () => {
      pair.adjectiveDraw[0] = 2000
      await expect(deployedContract.validTransitionTestable(encode(shuffle), encode(pair), 0, 2)).to.be.revertedWith("Adjective draw must be an integer less than the adjective list length")
    })
  })
});
