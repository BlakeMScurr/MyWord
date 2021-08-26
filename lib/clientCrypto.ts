import { ethers } from "ethers";

// get a new nonce shared with the server
export async function getServerNonce() {
    // make commitment
    let secretUint = randomUint256()
    let commitment = ethers.utils.keccak256(secretUint)

    // inform server of commitment and get server's part
    let response = await fetch("/api/nonceAgreement", {
        method: "post",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            commitment: commitment,
        })
    })
    let json = await response.json()
    let serverRand = ethers.BigNumber.from(json.rand)

    // make nonce
    let nonce = ethers.utils.keccak256(ethers.BigNumber.from(secretUint).add(serverRand).toHexString())

    // inform server of nonce
    response = await fetch("/api/nonce", {
        method: "post",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            nonce: nonce,
            commitment: commitment,
            secret: secretUint
        })
    })
}

export function randomUint256():string {
    // generate cryptographically secure random bits
    var rands = new Uint32Array(8);
    window.crypto.getRandomValues(rands);

    // convert to 256 bit hex string
    let hexStr = "0x";
    for (var i = 0; i < rands.length; i++) {
        let hex = rands[i].toString(16);
        hex = "0".repeat(8-hex.length) + hex;
        hexStr += hex;
    }
    return hexStr
}