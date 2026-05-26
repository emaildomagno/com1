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
exports.encode = exports.decodeFirst = void 0;
/* eslint-disable @typescript-eslint/ban-ts-comment */
const cborx = __importStar(require("cbor-x"));
/**
 * This encoder should keep CBOR data the same length when data is re-encoded
 *
 * MOST CRITICALLY, this means the following needs to be true of whatever CBOR library we use:
 * - CBOR Map type values MUST decode to JavaScript Maps
 * - CBOR tag 64 (uint8 Typed Array) MUST NOT be used when encoding Uint8Arrays back to CBOR
 *
 * So long as these requirements are maintained, then CBOR sequences can be encoded and decoded
 * freely while maintaining their lengths for the most accurate pointer movement across them.
 */
const encoder = new cborx.Encoder({ mapsAsObjects: false, tagUint8Array: false });
/**
 * Decode and return the first item in a sequence of CBOR-encoded values
 *
 * @param input The CBOR data to decode
 * @param asObject (optional) Whether to convert any CBOR Maps into JavaScript Objects. Defaults to
 * `false`
 */
function decodeFirst(input) {
    const decoded = encoder.decodeMultiple(input);
    if (decoded === undefined) {
        throw new Error('CBOR input data was empty');
    }
    /**
     * Typing on `decoded` is `void | []` which causes TypeScript to think that it's an empty array,
     * and thus you can't destructure it. I'm ignoring that because the code works fine in JS, and
     * so this should be a valid operation.
     */
    // @ts-ignore 2493
    const [first] = decoded;
    return first;
}
exports.decodeFirst = decodeFirst;
/**
 * Encode data to CBOR
 */
function encode(input) {
    return encoder.encode(input);
}
exports.encode = encode;
//# sourceMappingURL=isoCBOR.js.map