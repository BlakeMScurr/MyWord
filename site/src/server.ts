// TODO: call out to postgres
class database {
    private nonceAgreements: Map<string, string>;
    private nonces: Map<string, boolean>;
    constructor() {
        this.nonceAgreements = new Map<string, string>();
        this.nonces = new Map<string, boolean>();
    }

    setNonceAgreement(clientCommitment: string, serverRand: string) {
        this.nonceAgreements.set(clientCommitment, serverRand);
    }

    getRandFromNonceAgreement(clientCommitment: string) {
        return this.nonceAgreements.get(clientCommitment)
    }

    removeNonceAgreement(clientCommitment: string) {
        this.nonceAgreements.delete(clientCommitment);
    }

    addNonce(nonce: string) {
        this.nonces.set(nonce, true)
    }
}

export const db = new database()

