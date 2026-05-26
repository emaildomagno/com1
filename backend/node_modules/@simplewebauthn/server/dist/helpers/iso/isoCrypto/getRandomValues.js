"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomValues = void 0;
const iso_webcrypto_1 = __importDefault(require("@simplewebauthn/iso-webcrypto"));
/**
 * Fill up the provided bytes array with random bytes equal to its length.
 *
 * @returns the same bytes array passed into the method
 */
function getRandomValues(array) {
    iso_webcrypto_1.default.getRandomValues(array);
    return array;
}
exports.getRandomValues = getRandomValues;
//# sourceMappingURL=getRandomValues.js.map