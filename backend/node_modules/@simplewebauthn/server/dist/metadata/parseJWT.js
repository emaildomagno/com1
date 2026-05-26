"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJWT = void 0;
const iso_1 = require("../helpers/iso");
/**
 * Process a JWT into Javascript-friendly data structures
 */
function parseJWT(jwt) {
    const parts = jwt.split('.');
    return [
        JSON.parse(iso_1.isoBase64URL.toString(parts[0])),
        JSON.parse(iso_1.isoBase64URL.toString(parts[1])),
        parts[2],
    ];
}
exports.parseJWT = parseJWT;
//# sourceMappingURL=parseJWT.js.map