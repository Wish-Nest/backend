import {PrivateKey, PublicKey} from "./key.js";
import {getRandomValues, subtle} from "crypto";
import {DerivedKey} from "./derived-key.js";
import {arrayBufferToBase64, base64ToArrayBuffer, generateKeyPair} from "./common.js";
import {GroupUserPrivateKey, GroupUserPublicKey} from "./group-key.js";

export async function generateUserKeyPair(): Promise<{publicKey: UserPublicKey, privateKey: UserPrivateKey}> {
    const { publicKey, privateKey } = await generateKeyPair();

    return {
        publicKey: new UserPublicKey(publicKey),
        privateKey: new UserPrivateKey(privateKey)
    };
}

export class UserPublicKey extends PublicKey {
    static async import(encodeKey: string) : Promise<UserPublicKey> {
        return await PublicKey.import(encodeKey) as UserPublicKey;
    }
}

export class UserPrivateKey extends PrivateKey {
    static async import(encodeKey: string) : Promise<UserPrivateKey> {
        const key = await PrivateKey.import(encodeKey);
        return new UserPrivateKey(key.base);
    }

    async encryptWithDerived(key: DerivedKey) : Promise<string> {
        const exported = await this.export();
        const iv = getRandomValues(new Uint8Array(12));
        const ciphertext = await subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key.base,
            base64ToArrayBuffer(exported)
        );

        return `${arrayBufferToBase64(iv)}:${arrayBufferToBase64(ciphertext)}`;
    }

    static async decryptWithDerived(data: string, key: DerivedKey) : Promise<UserPrivateKey> {
        const [iv, ciphertext] = data.split(":").map(base64ToArrayBuffer);

        if(!ciphertext) {
            throw new Error("Invalid encrypted data");
        }

        const decrypted = await subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key.base,
            ciphertext
        );

        return UserPrivateKey.import(arrayBufferToBase64(decrypted));
    }

    async decryptGroupUserPrivateKey(data: string) : Promise<GroupUserPrivateKey> {
        return this.decode(data)
            .then((a) => GroupUserPrivateKey.import(a));
    }

    async decryptGroupUserPublicKey(data: string) : Promise<GroupUserPublicKey> {
        return this.decode(data)
            .then((a) => GroupUserPublicKey.import(a));
    }

}