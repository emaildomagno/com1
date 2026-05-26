"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify = void 0;
const cose_1 = require("../../cose");
const verifyEC2_1 = require("./verifyEC2");
const verifyRSA_1 = require("./verifyRSA");
const verifyOKP_1 = require("./verifyOKP");
const unwrapEC2Signature_1 = require("./unwrapEC2Signature");
/**
 * Verify signatures with their public key. Supports EC2 and RSA public keys.
 */
async function verify(opts) {
    const { cosePublicKey, signature, data, shaHashOverride } = opts;
    if ((0, cose_1.isCOSEPublicKeyEC2)(cosePublicKey)) {
        const unwrappedSignature = (0, unwrapEC2Signature_1.unwrapEC2Signature)(signature);
        return (0, verifyEC2_1.verifyEC2)({ cosePublicKey, signature: unwrappedSignature, data, shaHashOverride });
    }
    else if ((0, cose_1.isCOSEPublicKeyRSA)(cosePublicKey)) {
        return (0, verifyRSA_1.verifyRSA)({ cosePublicKey, signature, data, shaHashOverride });
    }
    else if ((0, cose_1.isCOSEPublicKeyOKP)(cosePublicKey)) {
        return (0, verifyOKP_1.verifyOKP)({ cosePublicKey, signature, data });
    }
    const kty = cosePublicKey.get(cose_1.COSEKEYS.kty);
    throw new Error(`Signature verification with public key of kty ${kty} is not supported by this method`);
}
exports.verify = verify;
//# sourceMappingURL=verify.js.map