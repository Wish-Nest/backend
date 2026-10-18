import {Collection, Entity, OneToMany, PrimaryKey, Property} from "@mikro-orm/core";
import {uuid} from "uuidv4";
import {UserFamily} from "../../family/database/family.entity.js";
import {verify} from "argon2";
import {DerivedKey} from "../../common/crypto/derived-key.js";
import {UserPrivateKey, UserPublicKey} from "../../common/crypto/user-key.js";
import {PushSubscription} from "../../push/database/push-subscription.entity.js";

@Entity({tableName: "users"})
export class User {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @Property({type: 'string', unique: true})
    email!: string;

    @Property({type: 'text'})
    password!: string;

    @Property({type: 'text'})
    salt!: string;

    @Property({type: 'boolean'})
    verified: boolean = false;

    @Property({type: 'text'})
    verification_code!: string | null;

    @Property({type: 'text', name: 'private_key'})
    _encrypted_private_key!: string;

    @Property({type: 'text', name: 'public_key'})
    _public_key!: string;

    @Property({type: 'boolean', name: 'is_virtual', defaultRaw: 'false'})
    virtual: boolean = false;

    @OneToMany(() => UserFamily, uf => uf.user)
    families = new Collection<UserFamily>(this);

    @OneToMany(() => PushSubscription, ps => ps.user)
    pushSubscriptions = new Collection<PushSubscription>(this);

    public isPasswordValid(password: string) {
        return verify(this.password, password);
    }

    public async getDerivedKey(password: string) {
        return DerivedKey.derive(password, this.salt);
    }

    public async getPublicKey(): Promise<UserPublicKey> {
        return UserPublicKey.import(this._public_key);
    }

    public async getPrivateKey(derivedKey: DerivedKey): Promise<UserPrivateKey> {
        return UserPrivateKey.decryptWithDerived(this._encrypted_private_key, derivedKey);
    }

    public getFamilyByUuid(familyUuid: string) : UserFamily | null {
        for (const uf of this.families) {
            if (uf.family.uuid === familyUuid) {
                return uf;
            }
        }
        return null;
    }
}