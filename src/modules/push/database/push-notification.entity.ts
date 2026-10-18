import {Entity, ManyToOne, PrimaryKey, Property} from "@mikro-orm/core";
import {uuid} from "uuidv4";
import {User} from "../../user/database/user.entity.js";

@Entity({tableName: "push_notifications"})
export class PushNotification {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @ManyToOne(() => User, {fieldName: "user_uuid"})
    user!: User;

    @Property({type: 'text'})
    title!: string;

    @Property({type: 'text', nullable: true})
    body?: string;

    @Property({type: 'text', nullable: true})
    icon?: string | null;

    @Property({type: 'text', nullable: true})
    badge?: string | null;

    // Stored as JSON string
    @Property({type: 'text', nullable: true})
    data?: string | null;

    @Property({type: 'boolean'})
    read: boolean = false;

    @Property({type: 'datetime'})
    createdAt: Date = new Date();
}

