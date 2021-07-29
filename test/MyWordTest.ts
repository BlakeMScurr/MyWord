import { AllocationAssetOutcome, encodeOutcome, Outcome, VariablePart } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { BigNumberish, ethers } from "ethers";
import { ABI } from "../lib/abi"
import { ethers as hEthers} from "hardhat";
import * as contract from "../artifacts/contracts/MyWord.sol/MyWord.json";
import { MyWord__factory } from "../typechain"
import type { MyWord } from "../typechain"
import { Draw, Guess, Pair, Reveal, Shuffle } from "../generated/MyWord";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("MyWord", async function () {
  let deployedContract: MyWord
  let abi: ABI;
  const nounListLength = 1000;
  const adjectiveListLength = 2000;
  let signers: SignerWithAddress[]
  let defaultAllocation: AllocationAssetOutcome
  before(async () => {
    const contractFactory = new MyWord__factory((await hEthers.getSigners())[0]);
    deployedContract = await contractFactory.deploy();
    await deployedContract.deployed();
    abi = new ABI(new ethers.utils.Interface(contract.abi))
    signers = await hEthers.getSigners()
    defaultAllocation = {
      assetHolderAddress: deployedContract.address, // TODO: make this the actual asset holder, rather than just the 
      allocationItems: [
        { destination: ethers.utils.hexZeroPad(signers[0].address, 32), amount: "0x0c" },
        { destination: ethers.utils.hexZeroPad(signers[1].address, 32), amount: "0x00" },
      ],
    }
  })

  function getOutcome(isTurnA?: boolean, specifiedOutcomes?: [string, string]) {
    let outcome = [defaultAllocation]
    outcome = JSON.parse(JSON.stringify(outcome))
    if (isTurnA) {
      // flip amounts
      let tmp = outcome[0].allocationItems[0].amount
      outcome[0].allocationItems[0].amount = outcome[0].allocationItems[1].amount
      outcome[0].allocationItems[1].amount = tmp
    }
    if (specifiedOutcomes) {
      outcome[0].allocationItems[0].amount = specifiedOutcomes[0]
      outcome[0].allocationItems[1].amount = specifiedOutcomes[1]
    }
    return outcome
  }

  // no outcome encode
  let encode = (state, isTurnA?: boolean, outcomes?: [string, string]):VariablePart => {
    return {
      outcome: encodeOutcome(getOutcome(isTurnA, outcomes)),
      appData: abi.encodeStruct(state),
    }
  }

  let encodeGenericStruct = (kind, isTurnA?, nll?, all?, tres?):VariablePart => {
    return {
      outcome: encodeOutcome(getOutcome(isTurnA)),
      appData: abi.encodeGenericStruct(kind, nll ? nll : nounListLength, all ? all : adjectiveListLength, tres ? tres : {a: 1, b: 1, pot: 4}),
    }
  }

  it("State machine should have limited edges", async () => {
    await expect(deployedContract.validTransitionX(encodeGenericStruct("Draw", true), encodeGenericStruct("Pair"), 0, 2)).to.be.revertedWith("Invalid state kinds") // jump
    await expect(deployedContract.validTransitionX(encodeGenericStruct("Shuffle", true), encodeGenericStruct("Draw"), 0, 2)).to.be.revertedWith("Invalid state kinds") // reversed
    await expect(deployedContract.validTransitionX(encodeGenericStruct("Jazz", true), encodeGenericStruct("AppleTrane"), 0, 2)).to.be.revertedWith("Invalid state kinds") // garbace
  })

  it("Should not let the noun or adjective list lengths change", async() => {
    await expect(deployedContract.validTransitionX(encodeGenericStruct("Draw", true, 10, 10), encodeGenericStruct("Shuffle", false, 11, 10), 0, 2)).to.be.revertedWith("Noun list altered")
    await expect(deployedContract.validTransitionX(encodeGenericStruct("Draw", true, 10, 10), encodeGenericStruct("Shuffle", false, 10, 11), 0, 2)).to.be.revertedWith("Adjective list altered")
  })

  it("Should require flipped allocations", async() => {
    await expect(deployedContract.validTransitionX(encodeGenericStruct("Draw", 10, 10), encodeGenericStruct("Shuffle", 10, 10), 0, 2)).to.be.revertedWith("Allocations not flipped")
    await expect(deployedContract.validTransitionX(encodeGenericStruct("Draw", true, 10, 10), encodeGenericStruct("Shuffle", true, 10, 10), 0, 2)).to.be.revertedWith("Allocations not flipped")
  })

  describe("Draw -> Shuffle", () => {
    let commitment = ethers.utils.keccak256(ethers.utils.formatBytes32String("test"))
    let draw = new Draw(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 5}, commitment)

    it("Should allow valid transitions", async () => {
      let shuffle = new Shuffle(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 5}, [1,2], [3,4,5], commitment)
      expect(await deployedContract.validTransitionX(encode(draw, true), encode(shuffle), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      let shuffle = new Shuffle(nounListLength, adjectiveListLength, {a: 0, b: 7, pot: 5}, [1,2], [3,4,5], commitment)
      await expect(deployedContract.validTransitionX(encode(draw, true), encode(shuffle), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should not allow the draw commitment to be tampered with", async () => {
      let tamperedHash = ethers.utils.keccak256(ethers.utils.formatBytes32String("sneakily choosen numbers"))
      let shuffle = new Shuffle(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 5}, [1,2], [3,4,5], tamperedHash)
      await expect(deployedContract.validTransitionX(encode(draw, true), encode(shuffle), 0, 2)).to.be.revertedWith("Draw commitment tampered with")
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
      shuffle = new Shuffle(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 5}, [69,420], [19, 84, 911], drawCommitment)
      pair = new Pair(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 5}, ethers.constants.HashZero, [119, 419], [19, 148, 910], nounDraw, adjectiveDraw, salt)
    })


    it("Should allow valid transitions", async () => {
      expect(await deployedContract.validTransitionX(encode(shuffle, true), encode(pair), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      pair.treasury.a = 7
      pair.treasury.b = 0
      await expect(deployedContract.validTransitionX(encode(shuffle, true), encode(pair), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should provide draws and salt that match the commitment", async () => {
      shuffle.drawCommitment = ethers.constants.HashZero
      await expect(deployedContract.validTransitionX(encode(shuffle, true), encode(pair), 0, 2)).to.be.revertedWith("Draw reveal invalid")
    })

    it("Should calculate the cards correctly based on the draws and shuffles", async () => {
      pair.adjectives[0] = 431
      await expect(deployedContract.validTransitionX(encode(shuffle, true), encode(pair), 0, 2)).to.be.revertedWith("Selected card must be draw plus shuffle mod list length")
    })

    it("Should not allow out of range draws", async () => {
      pair.adjectiveDraw[0] = 2000
      await expect(deployedContract.validTransitionX(encode(shuffle, true), encode(pair), 0, 2)).to.be.revertedWith("Adjective draw must be an integer less than the adjective list length")
    })
  })

  describe("Pair -> Guess", () => {
    let pair: Pair
    let guess: Guess

    beforeEach(() => {
      let selectionCommitment = ethers.constants.HashZero
      pair = new Pair(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 5}, selectionCommitment, [0, 1], [0, 1, 2], [0, 0], [0, 0, 0], ethers.constants.HashZero)
      guess = new Guess(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 5}, [0,1], selectionCommitment, [0, 1], [0, 1, 2])
    })


    it("Should allow valid transitions", async () => {
      expect(await deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      guess.treasury.a = 7
      guess.treasury.b = 0
      await expect(deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should not let one tamper with the selection commitment", async () => {
      guess.selectionCommitment = ethers.utils.formatBytes32String("test")
      await expect(deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.be.revertedWith("Selection commitment tampered with")
    })

    it("Should not let one change the words drawn", async() => {
      guess.nouns = [0, 2]
      await expect(deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.be.revertedWith("Drawn nouns altered")
      guess.nouns = [0, 1]
      guess.adjectives = [0, 1, 3]
      await expect(deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.be.revertedWith("Drawn adjectives altered")
    })
    
    it("Should only allow guesses of 0, 1, or 2", async () => {
      // the uint8 data type restricts the possible range to non negative integers from 0 to 255
      // so we only *really* need to test that 3 is disallowed and 2 is allowed
      guess.guess = [3, 0]
      await expect(deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.be.revertedWith("Guess out of range [0, 2]")
      guess.guess = [0, 3]
      await expect(deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.be.revertedWith("Guess out of range [0, 2]")
      guess.guess = [0, 255]
      await expect(deployedContract.validTransitionX(encode(pair, true), encode(guess), 0, 2)).to.be.revertedWith("Guess out of range [0, 2]")
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
      guess = new Guess(nounListLength, adjectiveListLength, {a: 3, b: 4, pot: 2}, [0,1], commit([0,1]), nouns, adjectives)
      reveal = new Reveal(nounListLength, adjectiveListLength, { a: 4, b: 5, pot: 0 }, [0,1], salt)
    })

    it("Should not allow incorrect treasuries", async () => {
      guess.treasury.a = 7
      await expect(deployedContract.validTransitionX(encode(guess, true), encode(reveal, false, ["0x04", "0x05"]), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should require the selection to match the commitment", async () => {
      // suppose the salt is corrupted
      reveal.salt = 69420
      await expect(deployedContract.validTransitionX(encode(guess, true), encode(reveal, false, ["0x04", "0x05"]), 0, 2)).to.be.revertedWith("Selection reveal invalid")
      
      // suppose the selector attempts to change their selection
      reveal.salt = salt
      reveal.selection = [1, 0]
      await expect(deployedContract.validTransitionX(encode(guess, true), encode(reveal, false, ["0x04", "0x05"]), 0, 2)).to.be.revertedWith("Selection reveal invalid")
    })

    it("Should recognise agreements", async () => {
      expect(await deployedContract.validTransitionX(encode(guess, true), encode(reveal, false, ["0x04", "0x05"]), 0, 2)).to.equal(true)

      for (let i = 0; i < pairingOptions.length; i++) {
        const option = pairingOptions[i]
        guess.guess = option
        guess.selectionCommitment = commit(option)
        reveal.selection = option
        expect(await deployedContract.validTransitionX(encode(guess, true), encode(reveal, false, ["0x04", "0x05"]), 0, 2)).to.equal(true)
        expect(await deployedContract.validTransitionX(encode(guess), encode(reveal, true, ["0x04", "0x05"]), 1, 2)).to.equal(true)

        // test allocation sum greater than 12 (24)
        expect(await deployedContract.validTransitionX(encode(guess, true, ["0x00", "0x18"]), encode(reveal, false, ["0x08", "0x0a"]), 0, 2)).to.equal(true)
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
            reveal.treasury = {a: 5, b: 4, pot: 0}
            expect(await deployedContract.validTransitionX(encode(guess, true), encode(reveal, false, ["0x05", "0x04"]), 0, 2)).to.equal(true)
            reveal.treasury = {a: 3, b: 6, pot: 0}
            expect(await deployedContract.validTransitionX(encode(guess), encode(reveal, true, ["0x03", "0x06"]), 1, 2)).to.equal(true)
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

            reveal.treasury = {a: 3, b: 4, pot: 0}
            expect(await deployedContract.validTransitionX(encode(guess, true), encode(reveal, false, ["0x03", "0x04"]), 0, 2)).to.equal(true)
            expect(await deployedContract.validTransitionX(encode(guess), encode(reveal, true, ["0x03", "0x04"]), 1, 2)).to.equal(true)
          }
        }
      }
    })
  })

  describe("Reveal -> Draw", () => {
    let reveal: Reveal
    let draw: Draw

    beforeEach(() => {
      reveal = new Reveal(nounListLength, adjectiveListLength, { a: 4, b: 5, pot: 3 }, [0,1], 123456789)
      draw = new Draw(nounListLength, adjectiveListLength, { a: 4, b: 5, pot: 3 }, ethers.constants.HashZero)
    })

    it("Should allow transitions valid transitions", async () => {
      expect(await deployedContract.validTransitionX(encode(reveal, true), encode(draw), 0, 2)).to.equal(true)
    })

    it("Should not allow the treasury to change", async () => {
      draw.treasury = { a: 6, b: 5, pot: 3 }
      await expect(deployedContract.validTransitionX(encode(reveal, true), encode(draw), 0, 2)).to.be.revertedWith("Treasuries not equal")
    })

    it("Should require 2 or more coins in the pot", async () => {
       let treasury = { a: 6, b: 0, pot: 0 }
       draw.treasury = treasury
       reveal.treasury = treasury
      await expect(deployedContract.validTransitionX(encode(reveal, true, ["0x06", "0x00"]), encode(draw, false, ["0x03", "0x00"]), 0, 2)).to.be.revertedWith("Can't start a new round with less than 2 coins in the pot")
    })
  })
})
