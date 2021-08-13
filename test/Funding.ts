import { AllocationAssetOutcome, encodeOutcome, Outcome, VariablePart, ContractArtifacts } from "@statechannels/nitro-protocol";
import { expect } from "chai";
import { BigNumberish, ethers, Signer } from "ethers";
import { ABI } from "../lib/abi"
import { ethers as hEthers} from "hardhat";
import * as contract from "../artifacts/contracts/MyWord.sol/MyWord.json";
import { AssetHolder, AssetHolder__factory, Iudex, MyWord__factory, Nitroadj, NitroAdjudicator } from "../typechain"
import type { MyWord } from "../typechain"
import { Draw, Guess, Pair, Reveal, Shuffle } from "../generated/MyWord";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Funding", async function () {
    let myWord: MyWord;
    let iudex: Iudex;
    let adj: NitroAdjudicator;
    let assetHolder: AssetHolder;
    let signers: Array<SignerWithAddress>;

    before(async () => {
        signers = await hEthers.getSigners()

        // Deply contracts
        // Deploy MyWord ForceMove app
        const myWordFactory = await hEthers.getContractFactory("MyWord");
        myWord = await myWordFactory.deploy();
        await myWord.deployed();

        // Deploy Adjudicator
        const adjFact = await hEthers.getContractFactory("NitroAdjudicator");
        adj = await adjFact.deploy();
        await adj.deployed();
        
        // Deploy ERC20
        let Iudex = await hEthers.getContractFactory("Iudex");
        iudex = await Iudex.deploy(signers[0].address);
        await iudex.deployed();
        
        // Deploy Asset Holder
        const assetHolderFact = await hEthers.getContractFactory("ERC20AssetHolder");
        assetHolder = await assetHolderFact.deploy(adj.address, iudex.address);
        await assetHolder.deployed();
    })

    it("should have a properly deployed erc20", async () => {
        expect(await iudex.balanceOf(signers[0].address)).to.equal(ethers.constants.MaxUint256);
    })
})
