import { expect } from "chai";
import { ethers } from "ethers";
import { ethers as hEthers} from "hardhat";
import { AssetHolder, Iudex, NitroAdjudicator } from "../typechain"
import type { MyWord } from "../typechain"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Channel, convertAddressToBytes32, getChannelId, signState, signStates, State } from "@statechannels/nitro-protocol";

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

        // Give iudex to participants
        await iudex.connect(signers[0]).transfer(signers[1].address, ethers.BigNumber.from(1000))
    })

    it("should have a properly deployed erc20", async () => {
        expect(await iudex.balanceOf(signers[0].address)).to.equal(ethers.constants.MaxUint256.sub(ethers.BigNumber.from(1000)));
        expect(await iudex.balanceOf(signers[1].address)).to.equal(ethers.BigNumber.from(1001));
    })

    it("should allow ledger channel funding", async () => {
        const ledgerChannel: Channel = {
            chainId: "31337",
            channelNonce: 0,
            participants: [signers[0].address, signers[1].address],
        };
        const ledgerChannelId = getChannelId(ledgerChannel);

        // Construct a state for that allocates 6 iudex to each of us, and has turn numer n - 1
        // This is called the "pre fund setup" state
        const sixEachStatePreFS: State = {
            isFinal: false,
            channel: ledgerChannel,
            outcome: [
              {
                assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
                allocationItems: [
                  {
                    destination: convertAddressToBytes32(signers[0].address),
                    amount: ethers.BigNumber.from(6).toHexString(),
                  },
                  {
                    destination: convertAddressToBytes32(signers[1].address),
                    amount: ethers.BigNumber.from(6).toHexString(),
                  },
                ],
              },
            ],
            appDefinition: ethers.constants.AddressZero,
            appData: ethers.constants.HashZero,
            challengeDuration: 1,
            turnNum: 1,
          };

        // Collect a support proof by getting all participants to sign this state
        // let signatures;
        // signatures = [
        //     signState(sixEachStatePreFS, signers[0]).signature, // FIXME
        //     signState(sixEachStatePreFS, hubSigningKey).signature,
        // ];

        let signatures = signStates([sixEachStatePreFS], [new ethers.Wallet(), signers[1]], [])
        expect(JSON.stringify(signatures)).toEqual(
            // LOOK FOR FIXME ABOVE
            '[{"r":"0xd8ba8e03963a408bf00ea1f44b9f12604762fe3b3075e96d060b4282a355bf17","s":"0x7c53e0ae7241b676132f975a51d5fefdcbfb94c1a62b627cda3fce56b5a6310e","_vs":"0x7c53e0ae7241b676132f975a51d5fefdcbfb94c1a62b627cda3fce56b5a6310e","recoveryParam":0,"v":27},{"r":"0x316c53596fed74cc6ececb77fd164832517e2ab6591ba8f850d6bcc008041bbf","s":"0x22d6307912fa14a073fdab7ba38b52e199d3c2880d3699e4282c301dd0868821","_vs":"0xa2d6307912fa14a073fdab7ba38b52e199d3c2880d3699e4282c301dd0868821","recoveryParam":1,"v":28}]'
        );
    })
})
