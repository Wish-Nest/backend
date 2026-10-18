import {DerivedKey} from "../crypto/derived-key.js";
import jwt from 'jsonwebtoken';
const { verify, sign } = jwt;

export type JwtToken = {
    uuid: string;
    email: string;
    verified: boolean;
    derived_key: DerivedKey;
};

export type EncodedJwt = {
    uuid: string;
    email: string;
    verified: boolean;
    derived_key: string;
}

export async function decodeJwt(jwt: string) : Promise<false|JwtToken> {
    return new Promise((resolve, reject) => {
        verify(jwt, 'secret', async (err: any, decoded: any) => {
            if (err) {
                resolve(false);
            } else {
                try {
                    const derived_key = await DerivedKey.fromB64(decoded.derived_key);
                    resolve({
                        uuid: decoded.uuid,
                        email: decoded.email,
                        verified: decoded.verified,
                        derived_key
                    });
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}

export async function encodeJwt(data: JwtToken) : Promise<string> {
    return new Promise((resolve, reject) => {
        data.derived_key.toB64().then((derivedKey: string) => {
            // @ts-ignore
            sign({
                uuid: data.uuid,
                email: data.email,
                verified: data.verified,
                derived_key: derivedKey
            }, 'secret', {}, (err: any, token: JwtToken) => {
                if(err){
                    reject(err);
                }else{
                    // @ts-ignore
                    resolve(token);
                }
            });
        }).catch(reject);
    });
}