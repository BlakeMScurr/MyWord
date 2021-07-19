import { VariablePart } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { ethers } from "ethers";
import { ethers as hEthers} from "hardhat";

describe("MyWord", function () {
  let myWord: ethers.Contract
  before(async () => {
    const MyWord = await hEthers.getContractFactory("MyWord");
    myWord = await MyWord.deploy();
    await myWord.deployed();
  })

  it("Should handle draw -> shuffle transition", async () => {
    // TODO: hash an actual draw commitment
    let hash = ethers.utils.keccak256(ethers.utils.formatBytes32String("test"))
    let from: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: ethers.utils.defaultAbiCoder.encode(['bytes32', 'tuple(uint8, uint8, uint8)'], [hash, [3,4,5]]),
    }

    let to: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: ethers.utils.defaultAbiCoder.encode(['bytes32', 'tuple(uint8, uint8, uint8)', ''], [hash, [3,4,5]]),
    }

    expect(await myWord.validTransitionTestable(from, to, 0, 2)).to.equal(true)
  });
});
