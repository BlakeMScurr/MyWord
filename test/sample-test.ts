import { expect } from "chai";
import { ethers } from "hardhat";

describe("Greeter", function () {
  it("Should always return true", async function () {
    const Greeter = await ethers.getContractFactory("MyWord");
    const greeter = await Greeter.deploy();
    await greeter.deployed();

    // expect(await greeter.validTransition("adsf", ";llkhjj", 0, 2)).to.equal(true)
    expect(await greeter.say("bitch")).to.equal("you are a bitch");
  });
});
