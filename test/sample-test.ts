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
    let byteArg = ethers.utils.formatBytes32String("test")
    let hash = ethers.utils.keccak256(byteArg)
    let from: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: ethers.utils.defaultAbiCoder.encode(['bytes32'], [hash]),
    }

    let to: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: hEthers.constants.HashZero,
    }

    expect(await myWord.validTransitionTestable(from, to, 0, 2)).to.equal(true)
  });
});
