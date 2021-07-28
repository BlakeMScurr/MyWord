import { VariablePart } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { BigNumberish, ethers } from "ethers";
import { ABI } from "../lib/abi"
import { ethers as hEthers} from "hardhat";
import * as contract from "../artifacts/contracts/MyWord.sol/MyWord.json";
import { MyWord__factory } from "../typechain"
import type { MyWord } from "../typechain"
import { Draw, Guess, Pair, Reveal, Shuffle } from "../generated/MyWord";

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
      pair = new Pair(ethers.constants.HashZero, [119, 419], [19, 148, 910], nounDraw, adjectiveDraw, salt, {a: 3, b: 4, pot: 5})
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

  describe("Pair -> Guess", () => {
    let pair: Pair
    let guess: Guess

    beforeEach(() => {
      let selectionCommitment = ethers.constants.HashZero
      pair = new Pair(selectionCommitment, [0, 1], [0, 1, 2], [0, 0], [0, 0, 0], ethers.constants.HashZero, {a: 3, b: 4, pot: 5})
      guess = new Guess([0,1], selectionCommitment, [0, 1], [0, 1, 2], {a: 3, b: 4, pot: 5})
    })


    it("Should allow valid transitions", async () => {
      expect(await deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      guess.treasury.a = 7
      guess.treasury.b = 0
      await expect(deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should not let one tamper with the selection commitment", async () => {
      guess.selectionCommitment = ethers.utils.formatBytes32String("test")
      await expect(deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.be.revertedWith("Selection commitment tampered with")
    })

    it("Should not let one change the words drawn", async() => {
      guess.nouns = [0, 2]
      await expect(deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.be.revertedWith("Drawn nouns altered")
      guess.nouns = [0, 1]
      guess.adjectives = [0, 1, 3]
      await expect(deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.be.revertedWith("Drawn adjectives altered")
    })
    
    it("Should only allow guesses of 0, 1, or 2", async () => {
      // the uint8 data type restricts the possible range to non negative integers from 0 to 255
      // so we only *really* need to test that 3 is disallowed and 2 is allowed
      guess.guess = [3, 0]
      await expect(deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.be.revertedWith("Guess out of range [0, 2]")
      guess.guess = [0, 3]
      await expect(deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.be.revertedWith("Guess out of range [0, 2]")
      guess.guess = [0, 255]
      await expect(deployedContract.validTransitionTestable(encode(pair), encode(guess), 0, 2)).to.be.revertedWith("Guess out of range [0, 2]")
    })
  })

  describe("Guess -> Reveal", () => {
    let guess: Guess
    let reveal: Reveal
    let salt = 123456789
    let pairingOptions: Array<[number, number]> = [[0,1], [0,2], [1,1], [1,2], [2,1], [2,2]]
    let commit = (selection) => {
      return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([ "tuple(uint8, uint8)", "uint256" ], [selection, salt]))
    }

    beforeEach(() => {
      let nouns: [number, number] = [0,1]
      let adjectives: [number, number, number] = [0,1, 2]
      guess = new Guess([0,1], commit([0,1]), nouns, adjectives, {a: 3, b: 4, pot: 5})
      reveal = new Reveal([0,1], { a: 4, b: 5, pot: 3 }, salt)
    })

    it("Should not allow incorrect treasuries", async () => {
      guess.treasury.a = 7
      await expect(deployedContract.validTransitionTestable(encode(guess), encode(reveal), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should require the selection to match the commitment", async () => {
      // suppose the salt is corrupted
      reveal.salt = 69420
      await expect(deployedContract.validTransitionTestable(encode(guess), encode(reveal), 0, 2)).to.be.revertedWith("Selection reveal invalid")
      
      // suppose the selector attempts to change their selection
      reveal.salt = salt
      reveal.selection = [1, 0]
      await expect(deployedContract.validTransitionTestable(encode(guess), encode(reveal), 0, 2)).to.be.revertedWith("Selection reveal invalid")
    })

    it("Should recognise agreements", async () => {
      expect(await deployedContract.validTransitionTestable(encode(guess), encode(reveal), 0, 2)).to.equal(true)

      for (let i = 0; i < pairingOptions.length; i++) {
        const option = pairingOptions[i]
        guess.guess = option
        guess.selectionCommitment = commit(option)
        reveal.selection = option
        expect(await deployedContract.validTransitionTestable(encode(guess), encode(reveal), 0, 2)).to.equal(true)
        expect(await deployedContract.validTransitionTestable(encode(guess), encode(reveal), 1, 2)).to.equal(true)
      }
    })

    it("Should recognise bamboozles", async () => {
      for (let i = 0; i < pairingOptions.length; i++) {
        const g = pairingOptions[i];
        for (let j = 0; j < pairingOptions.length; j++) {
          const s = pairingOptions[j];
          // if the guesser only got one pairing right
          if ((g[0] != s[0] && g[1] == s[1]) || (g[0] == s[0] && g[1] != s[1])) {
            guess.guess = g
            guess.selectionCommitment = commit(s)
            reveal.selection = s

            // test in both turn types (with A as selector, and A as guesser)
            reveal.treasury = {a: 5, b: 4, pot: 3}
            expect(await deployedContract.validTransitionTestable(encode(guess), encode(reveal), 0, 2)).to.equal(true)
            reveal.treasury = {a: 3, b: 6, pot: 3}
            expect(await deployedContract.validTransitionTestable(encode(guess), encode(reveal), 1, 2)).to.equal(true)
          }
        }
      }
    })

    it("Should recognise bungles", async () => {
      for (let i = 0; i < pairingOptions.length; i++) {
        const g = pairingOptions[i];
        for (let j = 0; j < pairingOptions.length; j++) {
          const s = pairingOptions[j];
          // if the guesser gets nothing right
          if (g[0] != s[0] && g[1] != s[1]) {
            guess.guess = g
            guess.selectionCommitment = commit(s)
            reveal.selection = s

            reveal.treasury = {a: 3, b: 4, pot: 3}
            expect(await deployedContract.validTransitionTestable(encode(guess), encode(reveal), 0, 2)).to.equal(true)
            expect(await deployedContract.validTransitionTestable(encode(guess), encode(reveal), 1, 2)).to.equal(true)
          }
        }
      }
    })


  })

  describe("Reveal -> Draw", () => {
    let reveal: Reveal
    let draw: Draw

    beforeEach(() => {
      reveal = new Reveal([0,1], { a: 4, b: 5, pot: 3 }, 123456789)
      draw = new Draw(ethers.constants.HashZero, { a: 4, b: 5, pot: 3 })
    })

    it("Should allow transitions valid transitions", async () => {
      expect(await deployedContract.validTransitionTestable(encode(reveal), encode(draw), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      draw.treasury = { a: 6, b: 5, pot: 3 }
      await expect(deployedContract.validTransitionTestable(encode(reveal), encode(draw), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should require 2 or more coins in the pot", async () => {
       let treasury = { a: 4, b: 5, pot: 0 }
       draw.treasury = treasury
       reveal.treasury = treasury
      await expect(deployedContract.validTransitionTestable(encode(reveal), encode(draw), 0, 2)).to.be.revertedWith("Can't start a new round with less than 2 coins in the pot")
    })

  })
})
