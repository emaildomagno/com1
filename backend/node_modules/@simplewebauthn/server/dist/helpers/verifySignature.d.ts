import { COSEALG } from './cose';
/**
 * Verify an authenticator's signature
 */
export declare function verifySignature(opts: {
    signature: Uint8Array;
    data: Uint8Array;
    credentialPublicKey?: Uint8Array;
    x509Certificate?: Uint8Array;
    hashAlgorithm?: COSEALG;
}): Promise<boolean>;
