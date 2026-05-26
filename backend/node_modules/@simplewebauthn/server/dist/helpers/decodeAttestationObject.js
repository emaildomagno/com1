"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeAttestationObject = void 0;
const iso_1 = require("./iso");
/**
 * Convert an AttestationObject buffer to a proper object
 *
 * @param base64AttestationObject Attestation Object buffer
 */
function decodeAttestationObject(attestationObject) {
    return iso_1.isoCBOR.decodeFirst(attestationObject);
}
exports.decodeAttestationObject = decodeAttestationObject;
//# sourceMappingURL=decodeAttestationObject.js.map