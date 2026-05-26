import type { Base64URLString } from '@simplewebauthn/typescript-types';
/**
 * Convert buffer to an OpenSSL-compatible PEM text format.
 */
export declare function convertCertBufferToPEM(certBuffer: Uint8Array | Base64URLString): string;
