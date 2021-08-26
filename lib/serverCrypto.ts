import { randomBytes } from 'crypto';

export function randomUint256() {
    const value = randomBytes(32);
    return "0x" + value.toString('hex')
}