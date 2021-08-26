// TODO: call out to postgres
class database {
    nonceAgreements: Map<string, string>;
    constructor() {
        this.nonceAgreements = new Map<string, string>();
    }

    setNonceAgreement(clientCommitment: string, serverRand: string) {
        this.nonceAgreements.set(clientCommitment, serverRand);
    }
}

export const db = new database()

