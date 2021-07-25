import { VariablePart } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { ethers } from "ethers";
import { ABI } from "../lib/abi"
import { ethers as hEthers} from "hardhat";
import * as contract from "../artifacts/contracts/MyWord.sol/MyWord.json";
import { MyWord__factory } from "../typechain"
import type { MyWord } from "../typechain"
import { Draw } from "../generated/MyWord";

describe("MyWord", function () {
  let deployedContract: MyWord
  let abi: ABI;
  before(async () => {
    const contractFactory = new MyWord__factory((await hEthers.getSigners())[0]);
    deployedContract = await contractFactory.deploy();
    await deployedContract.deployed();
    abi = new ABI(new ethers.utils.Interface(contract.abi))
  })

  it("Should handle draw -> shuffle transition", async () => {
    // TODO: hash an actual draw commitment
    let hash = ethers.utils.keccak256(ethers.utils.formatBytes32String("test"))

    // deployedContract.DrawStruct.arguments()
    console.log(deployedContract.DrawStruct)

    let from: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: abi.encodeStruct("Draw", [hash, [3,4,5]]),
    }

    let to: VariablePart = {
      outcome: hEthers.constants.HashZero,
      appData: abi.encodeStruct("Shuffle", [[1,2,3,4,5], hash, [3,4,5]]),
    }

    expect(await deployedContract.validTransitionTestable(from, to, 0, 2)).to.equal(true)
  });

  it("Should handle shuffle -> draw transition", async () => {
    let data = [1,2,3,4,5,6,7,8,9,10]
    // sort the array
    let sorted = data.slice().sort((a,b) => a - b)
  })
});
