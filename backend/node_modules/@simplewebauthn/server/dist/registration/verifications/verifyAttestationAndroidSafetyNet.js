"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAttestationAndroidSafetyNet = void 0;
const toHash_1 = require("../../helpers/toHash");
const verifySignature_1 = require("../../helpers/verifySignature");
const getCertificateInfo_1 = require("../../helpers/getCertificateInfo");
const validateCertificatePath_1 = require("../../helpers/validateCertificatePath");
const convertCertBufferToPEM_1 = require("../../helpers/convertCertBufferToPEM");
const iso_1 = require("../../helpers/iso");
const metadataService_1 = require("../../services/metadataService");
const verifyAttestationWithMetadata_1 = require("../../metadata/verifyAttestationWithMetadata");
/**
 * Verify an attestation response with fmt 'android-safetynet'
 */
async function verifyAttestationAndroidSafetyNet(options) {
    const { attStmt, clientDataHash, authData, aaguid, rootCertificates, verifyTimestampMS = true, credentialPublicKey, } = options;
    const alg = attStmt.get('alg');
    const response = attStmt.get('response');
    const ver = attStmt.get('ver');
    if (!ver) {
        throw new Error('No ver value in attestation (SafetyNet)');
    }
    if (!response) {
        throw new Error('No response was included in attStmt by authenticator (SafetyNet)');
    }
    // Prepare to verify a JWT
    const jwt = iso_1.isoUint8Array.toUTF8String(response);
    const jwtParts = jwt.split('.');
    const HEADER = JSON.parse(iso_1.isoBase64URL.toString(jwtParts[0]));
    const PAYLOAD = JSON.parse(iso_1.isoBase64URL.toString(jwtParts[1]));
    const SIGNATURE = jwtParts[2];
    /**
     * START Verify PAYLOAD
     */
    const { nonce, ctsProfileMatch, timestampMs } = PAYLOAD;
    if (verifyTimestampMS) {
        // Make sure timestamp is in the past
        let now = Date.now();
        if (timestampMs > Date.now()) {
            throw new Error(`Payload timestamp "${timestampMs}" was later than "${now}" (SafetyNet)`);
        }
        // Consider a SafetyNet attestation valid within a minute of it being performed
        const timestampPlusDelay = timestampMs + 60 * 1000;
        now = Date.now();
        if (timestampPlusDelay < now) {
            throw new Error(`Payload timestamp "${timestampPlusDelay}" has expired (SafetyNet)`);
        }
    }
    const nonceBase = iso_1.isoUint8Array.concat([authData, clientDataHash]);
    const nonceBuffer = await (0, toHash_1.toHash)(nonceBase);
    const expectedNonce = iso_1.isoBase64URL.fromBuffer(nonceBuffer, 'base64');
    if (nonce !== expectedNonce) {
        throw new Error('Could not verify payload nonce (SafetyNet)');
    }
    if (!ctsProfileMatch) {
        throw new Error('Could not verify device integrity (SafetyNet)');
    }
    /**
     * END Verify PAYLOAD
     */
    /**
     * START Verify Header
     */
    // `HEADER.x5c[0]` is definitely a base64 string
    const leafCertBuffer = iso_1.isoBase64URL.toBuffer(HEADER.x5c[0], 'base64');
    const leafCertInfo = (0, getCertificateInfo_1.getCertificateInfo)(leafCertBuffer);
    const { subject } = leafCertInfo;
    // Ensure the certificate was issued to this hostname
    // See https://developer.android.com/training/safetynet/attestation#verify-attestation-response
    if (subject.CN !== 'attest.android.com') {
        throw new Error('Certificate common name was not "attest.android.com" (SafetyNet)');
    }
    const statement = await metadataService_1.MetadataService.getStatement(aaguid);
    if (statement) {
        try {
            await (0, verifyAttestationWithMetadata_1.verifyAttestationWithMetadata)({
                statement,
                credentialPublicKey,
                x5c: HEADER.x5c,
                attestationStatementAlg: alg,
            });
        }
        catch (err) {
            const _err = err;
            throw new Error(`${_err.message} (SafetyNet)`);
        }
    }
    else {
        try {
            // Try validating the certificate path using the root certificates set via SettingsService
            await (0, validateCertificatePath_1.validateCertificatePath)(HEADER.x5c.map(convertCertBufferToPEM_1.convertCertBufferToPEM), rootCertificates);
        }
        catch (err) {
            const _err = err;
            throw new Error(`${_err.message} (SafetyNet)`);
        }
    }
    /**
     * END Verify Header
     */
    /**
     * START Verify Signature
     */
    const signatureBaseBuffer = iso_1.isoUint8Array.fromUTF8String(`${jwtParts[0]}.${jwtParts[1]}`);
    const signatureBuffer = iso_1.isoBase64URL.toBuffer(SIGNATURE);
    const verified = await (0, verifySignature_1.verifySignature)({
        signature: signatureBuffer,
        data: signatureBaseBuffer,
        x509Certificate: leafCertBuffer,
    });
    /**
     * END Verify Signature
     */
    return verified;
}
exports.verifyAttestationAndroidSafetyNet = verifyAttestationAndroidSafetyNet;
//# sourceMappingURL=verifyAttestationAndroidSafetyNet.js.map