import {subtle} from "crypto";
import {arrayBufferToBase64, base64ToArrayBuffer} from "./common.js";

abstract class Key {
    base: CryptoKey;

    constructor(base: CryptoKey) {
        this.base = base;
    }

    abstract getAlgorithm(): "raw" | "pkcs8" | "spki";

    async export(): Promise<string> {
        const exportedPublicKey = await subtle.exportKey(this.getAlgorithm(), this.base);
        return arrayBufferToBase64(exportedPublicKey);
    }
}

const PUBLIC_KEY_ALGORITHM: "raw" | "pkcs8" | "spki" = "spki";

export class PublicKey extends Key {

    getAlgorithm(): "raw" | "pkcs8" | "spki" {
        return PUBLIC_KEY_ALGORITHM;
    }

    static async import(encodeKey: string) : Promise<PublicKey> {
        const publicKeyBuffer = base64ToArrayBuffer(encodeKey);

        return new this(await subtle.importKey(
            PUBLIC_KEY_ALGORITHM,
            publicKeyBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        ));
    }

    async encode(data: string) : Promise<string> {
        const encryptedChunks: Promise<string>[] = [];
        let offset = 0;
        const chunkSize = 150; // 2048-bit key size - 42 bytes
        while (offset < data.length) {
            const chunk = data.slice(offset, offset + chunkSize);

            encryptedChunks.push(subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                this.base,
                new TextEncoder().encode(chunk)
            ).then((encrypted) => arrayBufferToBase64(encrypted)));

            offset += chunkSize;
        }

        return Promise.all(encryptedChunks).then((chunks) => chunks.join(":"));
    }
}

const PRIVATE_KEY_ALGORITHM: "pkcs8" | "spki" = "pkcs8";

export class PrivateKey extends Key {
    getAlgorithm(): "raw" | "pkcs8" | "spki" {
        return PRIVATE_KEY_ALGORITHM;
    }

    static async import(encodeKey: string) : Promise<PrivateKey> {
        const privateKeyBuffer = base64ToArrayBuffer(encodeKey);

        return new this(await subtle.importKey(
            PRIVATE_KEY_ALGORITHM,
            privateKeyBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["decrypt"]
        ));
    }

    async decode(data: string) : Promise<string> {
        const decryptedChunks: Promise<string>[] = [];

        for (const encryptedChunk of data.split(":")) {
            decryptedChunks.push(subtle.decrypt(
                {
                    name: "RSA-OAEP"
                },
                this.base,
                base64ToArrayBuffer(encryptedChunk)
            ).then((decrypted) => new TextDecoder().decode(decrypted)));
        }

        return Promise.all(decryptedChunks).then((chunks) => chunks.join(""));
    }
}