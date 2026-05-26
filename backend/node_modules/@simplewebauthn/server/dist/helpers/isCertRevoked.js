"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCertRevoked = void 0;
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const asn1_schema_1 = require("@peculiar/asn1-schema");
const asn1_x509_1 = require("@peculiar/asn1-x509");
const iso_1 = require("./iso");
const cacheRevokedCerts = {};
/**
 * A method to pull a CRL from a certificate and compare its serial number to the list of revoked
 * certificate serial numbers within the CRL.
 *
 * CRL certificate structure referenced from https://tools.ietf.org/html/rfc5280#page-117
 */
async function isCertRevoked(cert) {
    var _a, _b;
    const { extensions } = cert.tbsCertificate;
    if (!extensions) {
        return false;
    }
    let extAuthorityKeyID;
    let extSubjectKeyID;
    let extCRLDistributionPoints;
    extensions.forEach(ext => {
        if (ext.extnID === asn1_x509_1.id_ce_authorityKeyIdentifier) {
            extAuthorityKeyID = asn1_schema_1.AsnParser.parse(ext.extnValue, asn1_x509_1.AuthorityKeyIdentifier);
        }
        else if (ext.extnID === asn1_x509_1.id_ce_subjectKeyIdentifier) {
            extSubjectKeyID = asn1_schema_1.AsnParser.parse(ext.extnValue, asn1_x509_1.SubjectKeyIdentifier);
        }
        else if (ext.extnID === asn1_x509_1.id_ce_cRLDistributionPoints) {
            extCRLDistributionPoints = asn1_schema_1.AsnParser.parse(ext.extnValue, asn1_x509_1.CRLDistributionPoints);
        }
    });
    // Check to see if we've got cached info for the cert's CA
    let keyIdentifier = undefined;
    if (extAuthorityKeyID && extAuthorityKeyID.keyIdentifier) {
        keyIdentifier = iso_1.isoUint8Array.toHex(new Uint8Array(extAuthorityKeyID.keyIdentifier.buffer));
    }
    else if (extSubjectKeyID) {
        /**
         * We might be dealing with a self-signed root certificate. Check the
         * Subject key Identifier extension next.
         */
        keyIdentifier = iso_1.isoUint8Array.toHex(new Uint8Array(extSubjectKeyID.buffer));
    }
    const certSerialHex = iso_1.isoUint8Array.toHex(new Uint8Array(cert.tbsCertificate.serialNumber));
    if (keyIdentifier) {
        const cached = cacheRevokedCerts[keyIdentifier];
        if (cached) {
            const now = new Date();
            // If there's a nextUpdate then make sure we're before it
            if (!cached.nextUpdate || cached.nextUpdate > now) {
                return cached.revokedCerts.indexOf(certSerialHex) >= 0;
            }
        }
    }
    const crlURL = (_b = (_a = extCRLDistributionPoints === null || extCRLDistributionPoints === void 0 ? void 0 : extCRLDistributionPoints[0].distributionPoint) === null || _a === void 0 ? void 0 : _a.fullName) === null || _b === void 0 ? void 0 : _b[0].uniformResourceIdentifier;
    // If no URL is provided then we have nothing to check
    if (!crlURL) {
        return false;
    }
    // Download and read the CRL
    let certListBytes;
    try {
        const respCRL = await (0, cross_fetch_1.default)(crlURL);
        certListBytes = await respCRL.arrayBuffer();
    }
    catch (err) {
        return false;
    }
    let data;
    try {
        data = asn1_schema_1.AsnParser.parse(certListBytes, asn1_x509_1.CertificateList);
    }
    catch (err) {
        // Something was malformed with the CRL, so pass
        return false;
    }
    const newCached = {
        revokedCerts: [],
        nextUpdate: undefined,
    };
    // nextUpdate
    if (data.tbsCertList.nextUpdate) {
        newCached.nextUpdate = data.tbsCertList.nextUpdate.getTime();
    }
    // revokedCertificates
    const revokedCerts = data.tbsCertList.revokedCertificates;
    if (revokedCerts) {
        for (const cert of revokedCerts) {
            const revokedHex = iso_1.isoUint8Array.toHex(new Uint8Array(cert.userCertificate));
            newCached.revokedCerts.push(revokedHex);
        }
        // Cache the results
        if (keyIdentifier) {
            cacheRevokedCerts[keyIdentifier] = newCached;
        }
        return newCached.revokedCerts.indexOf(certSerialHex) >= 0;
    }
    return false;
}
exports.isCertRevoked = isCertRevoked;
//# sourceMappingURL=isCertRevoked.js.map