import { COSEPublicKeyOKP } from '../../cose';
export declare function verifyOKP(opts: {
    cosePublicKey: COSEPublicKeyOKP;
    signature: Uint8Array;
    data: Uint8Array;
}): Promise<boolean>;
