import { VariablePart } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { ethers } from "ethers";
import { ABI } from "../lib/abi"
import { ethers as hEthers} from "hardhat";
import * as contract from "../artifacts/contracts/MyWord.sol/MyWord.json";


describe("MyWord", function () {
  let myWord: ethers.Contract
  let inf: ABI;
  before(async () => {
    const MyWord = await hEthers.getContractFactory("MyWord");
    myWord = await MyWord.deploy();
    await myWord.deployed();

    inf = new ABI(new ethers.utils.Interface(contract.abi))
  })

  it("Should handle draw -> shuffle transition", async () => {
    // TODO: hash an actual draw commitment
    let hash = ethers.utils.keccak256(ethers.utils.formatBytes32String("test"))

    let data = [hash, [3,4,5]]

    let from: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: inf.encodeStruct("Draw", [hash, [3,4,5]]),
    }

    let to: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: inf.encodeStruct("Shuffle", [[1,2,3,4,5], hash, [3,4,5]]),
    }

    expect(await myWord.validTransitionTestable(from, to, 0, 2)).to.equal(true)
  });
});
