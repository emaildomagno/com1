"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeCredentialPublicKey = void 0;
const iso_1 = require("./iso");
function decodeCredentialPublicKey(publicKey) {
    return iso_1.isoCBOR.decodeFirst(publicKey);
}
exports.decodeCredentialPublicKey = decodeCredentialPublicKey;
//# sourceMappingURL=decodeCredentialPublicKey.js.map