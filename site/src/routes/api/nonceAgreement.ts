import { randomUint256 } from "../../../../lib/serverCrypto"
import { db } from "../../server"

export async function post({ body }) {
    let rand = randomUint256()

    db.setNonceAgreement(body.commitment, rand)

    return {
        body: {
            rand: rand,
        }
    };
}