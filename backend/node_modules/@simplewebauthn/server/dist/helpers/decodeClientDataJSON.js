"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeClientDataJSON = void 0;
const iso_1 = require("./iso");
/**
 * Decode an authenticator's base64url-encoded clientDataJSON to JSON
 */
function decodeClientDataJSON(data) {
    const toString = iso_1.isoBase64URL.toString(data);
    const clientData = JSON.parse(toString);
    return clientData;
}
exports.decodeClientDataJSON = decodeClientDataJSON;
//# sourceMappingURL=decodeClientDataJSON.js.map