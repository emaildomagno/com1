"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignature = void 0;
const iso_1 = require("./iso");
const decodeCredentialPublicKey_1 = require("./decodeCredentialPublicKey");
const convertX509PublicKeyToCOSE_1 = require("./convertX509PublicKeyToCOSE");
/**
 * Verify an authenticator's signature
 */
async function verifySignature(opts) {
    const { signature, data, credentialPublicKey, x509Certificate, hashAlgorithm } = opts;
    if (!x509Certificate && !credentialPublicKey) {
        throw new Error('Must declare either "leafCert" or "credentialPublicKey"');
    }
    if (x509Certificate && credentialPublicKey) {
        throw new Error('Must not declare both "leafCert" and "credentialPublicKey"');
    }
    let cosePublicKey = new Map();
    if (credentialPublicKey) {
        cosePublicKey = (0, decodeCredentialPublicKey_1.decodeCredentialPublicKey)(credentialPublicKey);
    }
    else if (x509Certificate) {
        cosePublicKey = (0, convertX509PublicKeyToCOSE_1.convertX509PublicKeyToCOSE)(x509Certificate);
    }
    return iso_1.isoCrypto.verify({
        cosePublicKey,
        signature,
        data,
        shaHashOverride: hashAlgorithm,
    });
}
exports.verifySignature = verifySignature;
//# sourceMappingURL=verifySignature.js.map