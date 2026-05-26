"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.digest = void 0;
const iso_webcrypto_1 = __importDefault(require("@simplewebauthn/iso-webcrypto"));
const mapCoseAlgToWebCryptoAlg_1 = require("./mapCoseAlgToWebCryptoAlg");
/**
 * Generate a digest of the provided data.
 *
 * @param data The data to generate a digest of
 * @param algorithm A COSE algorithm ID that maps to a desired SHA algorithm
 */
async function digest(data, algorithm) {
    const subtleAlgorithm = (0, mapCoseAlgToWebCryptoAlg_1.mapCoseAlgToWebCryptoAlg)(algorithm);
    const hashed = await iso_webcrypto_1.default.subtle.digest(subtleAlgorithm, data);
    return new Uint8Array(hashed);
}
exports.digest = digest;
//# sourceMappingURL=digest.js.map