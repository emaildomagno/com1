import { COSEALG } from '../../cose';
import { SubtleCryptoKeyAlgName } from './structs';
/**
 * Convert a COSE alg ID into a corresponding key algorithm string value that WebCrypto APIs expect
 */
export declare function mapCoseAlgToWebCryptoKeyAlgName(alg: COSEALG): SubtleCryptoKeyAlgName;
