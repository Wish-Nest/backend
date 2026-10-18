import {Cascade, Entity, ManyToOne, OneToMany, PrimaryKey, Property} from "@mikro-orm/core";
import {uuid} from "uuidv4";
import {User} from "../../../user/database/user.entity.js";
import {Family} from "../../database/family.entity.js";
import {GroupUserPrivateKey, GroupUserPublicKey} from "../../../common/crypto/group-key.js";
import {UserPrivateKey} from "../../../common/crypto/user-key.js";
import {Gift} from "../../gift/database/gift.entity.js";

export type GroupPrivateData = {
    additional_gifts: PrivateGiftPrivateData[]
} & {
    [id: string]: GiftPrivateData
}

export type PrivateGiftPrivateData = Gift & {
    byUserUuid: string
};

export type GiftPrivateData = {
    messages: {
        content: string,
        timestamp: string,
        user_uuid: string
    }[],
    takenBy?: null|string
}

@Entity({tableName: "groups"})
export class Group {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @ManyToOne(() => User)
    target!: User;

    @ManyToOne(() => Family)
    family!: Family;

    @Property({type: "string", name: "private_data"})
    _encrypted_private_data!: string;

    @OneToMany(() => GroupUser, group_user => group_user.group, {cascade: [Cascade.PERSIST]})
    group_users!: GroupUser[];

    public async getPrivateData(private_key: GroupUserPrivateKey) : Promise<GroupPrivateData> {
        const private_data = await private_key.decode(this._encrypted_private_data);

        return JSON.parse(private_data) as GroupPrivateData;
    }

    public async getUser(user_uuid: string) : Promise<GroupUser|undefined> {
        return this.group_users.find((group_user) => group_user.user.uuid === user_uuid);
    }

    public async isMember(user_uuid: string) : Promise<boolean> {
        return (await this.getUser(user_uuid)) !== undefined;
    }
}

@Entity({tableName: "group_user"})
export class GroupUser {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @ManyToOne(() => User)
    user!: User;

    @ManyToOne(() => Group)
    group!: Group;

    @Property({type: "string", name: "private_key"})
    _encrypted_private_key!: string;

    @Property({type: "string", name: "public_key"})
    _encrypted_public_key!: string;

    public async getPrivateKey(user_private_key: UserPrivateKey) : Promise<GroupUserPrivateKey> {
        return user_private_key.decryptGroupUserPrivateKey(this._encrypted_private_key);
    }

    public async getPublicKey(user_private_key: UserPrivateKey) : Promise<GroupUserPublicKey> {
        return user_private_key.decryptGroupUserPublicKey(this._encrypted_public_key);
    }
}

@Entity({tableName: "group_request_user"})
export class GroupRequest {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @ManyToOne(() => User)
    user!: User;

    @ManyToOne(() => Group)
    group!: Group;
}