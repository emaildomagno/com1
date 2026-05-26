import { SubtleCryptoAlg } from './structs';
import { COSEALG } from '../../cose';
/**
 * Convert a COSE alg ID into a corresponding string value that WebCrypto APIs expect
 */
export declare function mapCoseAlgToWebCryptoAlg(alg: COSEALG): SubtleCryptoAlg;
