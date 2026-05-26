"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cose = exports.isoUint8Array = exports.isoBase64URL = exports.isoCrypto = exports.isoCBOR = exports.verifySignature = exports.validateCertificatePath = exports.toHash = exports.parseAuthenticatorData = exports.isCertRevoked = exports.getCertificateInfo = exports.generateChallenge = exports.decodeCredentialPublicKey = exports.decodeClientDataJSON = exports.decodeAttestationObject = exports.convertCOSEtoPKCS = exports.convertCertBufferToPEM = exports.convertAAGUIDToString = void 0;
const convertAAGUIDToString_1 = require("./convertAAGUIDToString");
Object.defineProperty(exports, "convertAAGUIDToString", { enumerable: true, get: function () { return convertAAGUIDToString_1.convertAAGUIDToString; } });
const convertCertBufferToPEM_1 = require("./convertCertBufferToPEM");
Object.defineProperty(exports, "convertCertBufferToPEM", { enumerable: true, get: function () { return convertCertBufferToPEM_1.convertCertBufferToPEM; } });
const convertCOSEtoPKCS_1 = require("./convertCOSEtoPKCS");
Object.defineProperty(exports, "convertCOSEtoPKCS", { enumerable: true, get: function () { return convertCOSEtoPKCS_1.convertCOSEtoPKCS; } });
const decodeAttestationObject_1 = require("./decodeAttestationObject");
Object.defineProperty(exports, "decodeAttestationObject", { enumerable: true, get: function () { return decodeAttestationObject_1.decodeAttestationObject; } });
const decodeClientDataJSON_1 = require("./decodeClientDataJSON");
Object.defineProperty(exports, "decodeClientDataJSON", { enumerable: true, get: function () { return decodeClientDataJSON_1.decodeClientDataJSON; } });
const decodeCredentialPublicKey_1 = require("./decodeCredentialPublicKey");
Object.defineProperty(exports, "decodeCredentialPublicKey", { enumerable: true, get: function () { return decodeCredentialPublicKey_1.decodeCredentialPublicKey; } });
const generateChallenge_1 = require("./generateChallenge");
Object.defineProperty(exports, "generateChallenge", { enumerable: true, get: function () { return generateChallenge_1.generateChallenge; } });
const getCertificateInfo_1 = require("./getCertificateInfo");
Object.defineProperty(exports, "getCertificateInfo", { enumerable: true, get: function () { return getCertificateInfo_1.getCertificateInfo; } });
const isCertRevoked_1 = require("./isCertRevoked");
Object.defineProperty(exports, "isCertRevoked", { enumerable: true, get: function () { return isCertRevoked_1.isCertRevoked; } });
const parseAuthenticatorData_1 = require("./parseAuthenticatorData");
Object.defineProperty(exports, "parseAuthenticatorData", { enumerable: true, get: function () { return parseAuthenticatorData_1.parseAuthenticatorData; } });
const toHash_1 = require("./toHash");
Object.defineProperty(exports, "toHash", { enumerable: true, get: function () { return toHash_1.toHash; } });
const validateCertificatePath_1 = require("./validateCertificatePath");
Object.defineProperty(exports, "validateCertificatePath", { enumerable: true, get: function () { return validateCertificatePath_1.validateCertificatePath; } });
const verifySignature_1 = require("./verifySignature");
Object.defineProperty(exports, "verifySignature", { enumerable: true, get: function () { return verifySignature_1.verifySignature; } });
const iso_1 = require("./iso");
Object.defineProperty(exports, "isoCBOR", { enumerable: true, get: function () { return iso_1.isoCBOR; } });
Object.defineProperty(exports, "isoBase64URL", { enumerable: true, get: function () { return iso_1.isoBase64URL; } });
Object.defineProperty(exports, "isoUint8Array", { enumerable: true, get: function () { return iso_1.isoUint8Array; } });
Object.defineProperty(exports, "isoCrypto", { enumerable: true, get: function () { return iso_1.isoCrypto; } });
const cose = __importStar(require("./cose"));
exports.cose = cose;
//# sourceMappingURL=index.js.map