import { randomUint256 } from "../../../../lib/serverCrypto"
import { db } from "../../server"

export async function post({ body }) {
    let rand = randomUint256()

    db.setNonceAgreement(rand, body.commitment)

    return {
        body: {
            rand: rand,
        }
    };
}