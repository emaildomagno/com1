"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unwrapEC2Signature = void 0;
const asn1_ecc_1 = require("@peculiar/asn1-ecc");
const asn1_schema_1 = require("@peculiar/asn1-schema");
const __1 = require("../");
/**
 * In WebAuthn, EC2 signatures are wrapped in ASN.1 structure so we need to peel r and s apart.
 *
 * See https://www.w3.org/TR/webauthn-2/#sctn-signature-attestation-types
 */
function unwrapEC2Signature(signature) {
    const parsedSignature = asn1_schema_1.AsnParser.parse(signature, asn1_ecc_1.ECDSASigValue);
    let rBytes = new Uint8Array(parsedSignature.r);
    let sBytes = new Uint8Array(parsedSignature.s);
    if (shouldRemoveLeadingZero(rBytes)) {
        rBytes = rBytes.slice(1);
    }
    if (shouldRemoveLeadingZero(sBytes)) {
        sBytes = sBytes.slice(1);
    }
    const finalSignature = __1.isoUint8Array.concat([rBytes, sBytes]);
    return finalSignature;
}
exports.unwrapEC2Signature = unwrapEC2Signature;
/**
 * Determine if the DER-specific `00` byte at the start of an ECDSA signature byte sequence
 * should be removed based on the following logic:
 *
 * "If the leading byte is 0x0, and the the high order bit on the second byte is not set to 0,
 * then remove the leading 0x0 byte"
 */
function shouldRemoveLeadingZero(bytes) {
    return bytes[0] === 0x0 && (bytes[1] & (1 << 7)) !== 0;
}
//# sourceMappingURL=unwrapEC2Signature.js.map