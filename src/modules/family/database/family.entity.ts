import {Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property} from "@mikro-orm/core";
import {uuid} from "uuidv4";
import {User} from "../../user/database/user.entity.js";

@Entity({tableName: "families"})
export class Family {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @Property({type: 'string', unique: true})
    name!: string;

    @OneToMany(() => UserFamily, uf => uf.family)
    members = new Collection<UserFamily>(this);

    public isMember(userUuid: string): boolean {
        return this.getMember(userUuid) !== null;
    }

    public getMember(userUuid: string): UserFamily | null {
        return this.members.getItems().find(uf => uf.user.uuid === userUuid) ?? null;
    }
}

@Entity({tableName: "user_family"})
export class UserFamily {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @ManyToOne(() => Family, {fieldName: "family_uuid", inversedBy: "members"})
    family!: Family;

    @ManyToOne(() => User, {fieldName: "user_uuid", inversedBy: "families"})
    user!: User;

    @Property({type: 'string'})
    name!: string;
}