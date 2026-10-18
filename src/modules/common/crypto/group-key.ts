import {subtle} from "crypto";
import {PrivateKey, PublicKey} from "./key.js";
import {UserPublicKey} from "./user-key.js";
import {arrayBufferToBase64, generateKeyPair} from "./common.js";

export async function generateGroupUserKeyPair(): Promise<{publicKey: GroupUserPublicKey, privateKey: GroupUserPrivateKey}> {
    const { publicKey, privateKey } = await generateKeyPair();

    return {
        publicKey: new GroupUserPublicKey(publicKey),
        privateKey: new GroupUserPrivateKey(privateKey)
    };
}

export class GroupUserPublicKey extends PublicKey {
    static async import(encodeKey: string) : Promise<GroupUserPublicKey> {
        const key = await PublicKey.import(encodeKey);
        return new GroupUserPublicKey(key.base);
    }

    async encrypt(key: UserPublicKey) : Promise<string> {
        const data = await this.export();

        const encryptedChunks: Promise<string>[] = [];
        let offset = 0;
        const chunkSize = 190; // 2048-bit key size - 42 bytes
        while (offset < data.length) {
            const chunk = data.slice(offset, offset + chunkSize);

            encryptedChunks.push(subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                key.base,
                new TextEncoder().encode(chunk)
            ).then((encrypted) => arrayBufferToBase64(encrypted)));

            offset += chunkSize;
        }

        return Promise.all(encryptedChunks)
            .then((a) => a.join(":"));
    }
}

export class GroupUserPrivateKey extends PrivateKey {
    static async import(encodeKey: string) : Promise<GroupUserPrivateKey> {
        const key = await PrivateKey.import(encodeKey);
        return new GroupUserPrivateKey(key.base);
    }

    async encrypt(key: UserPublicKey) : Promise<string> {
        const data = await this.export();

        const encryptedChunks: Promise<string>[] = [];
        let offset = 0;
        const chunkSize = 190; // 2048-bit key size - 42 bytes
        while (offset < data.length) {
            const chunk = data.slice(offset, offset + chunkSize);

            encryptedChunks.push(subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                key.base,
                new TextEncoder().encode(chunk)
            ).then((encrypted) => arrayBufferToBase64(encrypted)));

            offset += chunkSize;
        }

        return Promise.all(encryptedChunks)
            .then((a) => a.join(":"));
    }
}