import {subtle} from "crypto";
import {arrayBufferToBase64, base64ToArrayBuffer} from "./common.js";

const DERIVED_KEY_ALGORITHM = "PBKDF2";

export class DerivedKey {
    base: CryptoKey;

    constructor(base: CryptoKey) {
        this.base = base;
    }

    static async derive(password: string, saltBase64: string): Promise<DerivedKey> {
        const salt = base64ToArrayBuffer(saltBase64);

        const passwordKey = await subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            DERIVED_KEY_ALGORITHM,
            false,
            ["deriveKey"]
        );

        return new DerivedKey(await subtle.deriveKey(
            {
                name: DERIVED_KEY_ALGORITHM,
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            passwordKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        ));
    }

    static async fromB64(data: string) : Promise<DerivedKey> {
        return new DerivedKey(await subtle.importKey(
            "raw",
            base64ToArrayBuffer(data),
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        ));
    }

    async toB64(): Promise<string> {
        const exported = await subtle.exportKey("raw", this.base);
        return arrayBufferToBase64(exported);
    }
}