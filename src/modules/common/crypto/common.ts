import {getRandomValues, subtle} from "crypto";

export function arrayBufferToBase64(buffer: ArrayBuffer|Uint8Array): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
}


export async function generateSalt(): Promise<string> {
    const salt = getRandomValues(new Uint8Array(16)); // 128-bit salt
    return arrayBufferToBase64(salt);
}

export async function generateKeyPair() : Promise<{publicKey: CryptoKey, privateKey: CryptoKey}> {
    return subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    );
}