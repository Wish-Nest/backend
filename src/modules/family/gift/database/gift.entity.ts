import {Entity, ManyToOne, PrimaryKey, Property} from "@mikro-orm/core";
import {uuid} from "uuidv4";
import {UserFamily} from "../../database/family.entity.js";

@Entity({tableName: "gifts"})
export class Gift {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @ManyToOne(() => UserFamily)
    userFamily!: UserFamily;

    @Property({type: "string"})
    title!: string;

    @Property({type: "string"})
    content!: string;

    @Property({type: "json", nullable: true, name: "additional_links"})
    additional_links?: string[];

    @Property({type: "string", nullable: true})
    image?: string | null;

    @Property({type: "integer", default: 0})
    position: number = 0;
}