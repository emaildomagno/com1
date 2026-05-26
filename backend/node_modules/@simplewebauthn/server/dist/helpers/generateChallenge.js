"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChallenge = void 0;
const iso_1 = require("./iso");
/**
 * Generate a suitably random value to be used as an attestation or assertion challenge
 */
function generateChallenge() {
    /**
     * WebAuthn spec says that 16 bytes is a good minimum:
     *
     * "In order to prevent replay attacks, the challenges MUST contain enough entropy to make
     * guessing them infeasible. Challenges SHOULD therefore be at least 16 bytes long."
     *
     * Just in case, let's double it
     */
    const challenge = new Uint8Array(32);
    iso_1.isoCrypto.getRandomValues(challenge);
    return challenge;
}
exports.generateChallenge = generateChallenge;
//# sourceMappingURL=generateChallenge.js.map