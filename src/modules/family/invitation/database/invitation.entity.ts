import {Entity, ManyToOne, PrimaryKey, Property} from "@mikro-orm/core";
import {Family} from "../../database/family.entity.js";
import {uuid} from "uuidv4";

@Entity({tableName: "user_family_invitations"})
export class FamilyInvitation {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @Property({type: 'string'})
    email!: string;

    @ManyToOne(() => Family)
    family!: Family;
}