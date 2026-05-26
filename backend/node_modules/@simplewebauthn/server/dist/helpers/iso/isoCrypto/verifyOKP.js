"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOKP = void 0;
const iso_webcrypto_1 = __importDefault(require("@simplewebauthn/iso-webcrypto"));
const cose_1 = require("../../cose");
const index_1 = require("../../index");
const importKey_1 = require("./importKey");
async function verifyOKP(opts) {
    const { cosePublicKey, signature, data } = opts;
    const alg = cosePublicKey.get(cose_1.COSEKEYS.alg);
    const crv = cosePublicKey.get(cose_1.COSEKEYS.crv);
    const x = cosePublicKey.get(cose_1.COSEKEYS.x);
    if (!alg) {
        throw new Error('Public key was missing alg (OKP)');
    }
    if (!(0, cose_1.isCOSEAlg)(alg)) {
        throw new Error(`Public key had invalid alg ${alg} (OKP)`);
    }
    if (!crv) {
        throw new Error('Public key was missing crv (OKP)');
    }
    if (!x) {
        throw new Error('Public key was missing x (OKP)');
    }
    // Pulled key import steps from here:
    // https://wicg.github.io/webcrypto-secure-curves/#ed25519-operations
    let _crv;
    if (crv === cose_1.COSECRV.ED25519) {
        _crv = 'Ed25519';
    }
    else {
        throw new Error(`Unexpected COSE crv value of ${crv} (OKP)`);
    }
    const keyData = {
        kty: 'OKP',
        crv: _crv,
        alg: 'EdDSA',
        x: index_1.isoBase64URL.fromBuffer(x),
        ext: false,
    };
    const keyAlgorithm = {
        name: _crv,
        namedCurve: _crv,
    };
    const key = await (0, importKey_1.importKey)({
        keyData,
        algorithm: keyAlgorithm,
    });
    const verifyAlgorithm = {
        name: _crv,
    };
    return iso_webcrypto_1.default.subtle.verify(verifyAlgorithm, key, signature, data);
}
exports.verifyOKP = verifyOKP;
//# sourceMappingURL=verifyOKP.js.map