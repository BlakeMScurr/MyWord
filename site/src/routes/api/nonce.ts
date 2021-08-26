import { db } from "../../server"
import { ethers } from "ethers";

export async function post({ body }) {
    // check that the client secret matches the commitment
    if (ethers.utils.keccak256(body.secret) !== body.commitment) {
        return { status: 400, body: { error: "Commitment doesn't match client secret" } }
    }

    // check that the nonce valid
    let serverSecret = db.getRandFromNonceAgreement(body.commitment)
    if (ethers.utils.keccak256(ethers.BigNumber.from(body.secret).add(serverSecret).toHexString()) !== body.nonce) {
        return { status: 400, body: { error: "Nonce doesn't match secrets" } }
    }

    // add nonce to the database
    db.removeNonceAgreement(body.secret)
    db.addNonce(body.nonce)

    return { body: {} }
}