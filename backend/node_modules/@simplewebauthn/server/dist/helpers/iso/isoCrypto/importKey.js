"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importKey = void 0;
const iso_webcrypto_1 = __importDefault(require("@simplewebauthn/iso-webcrypto"));
async function importKey(opts) {
    const { keyData, algorithm } = opts;
    return iso_webcrypto_1.default.subtle.importKey('jwk', keyData, algorithm, false, ['verify']);
}
exports.importKey = importKey;
//# sourceMappingURL=importKey.js.map