import {Entity, ManyToOne, PrimaryKey, Property} from "@mikro-orm/core";
import {uuid} from "uuidv4";
import {User} from "../../user/database/user.entity.js";

@Entity({tableName: "push_subscriptions"})
export class PushSubscription {
    @PrimaryKey({type: 'uuid'})
    uuid: string = uuid();

    @ManyToOne(() => User, {fieldName: "user_uuid"})
    user!: User;

    @Property({type: 'text'})
    endpoint!: string;

    @Property({type: 'text', nullable: true})
    p256dh!: string | null;

    @Property({type: 'text', nullable: true})
    auth!: string | null;

    @Property({type: 'datetime'})
    createdAt: Date = new Date();

    @Property({type: 'datetime', nullable: true})
    lastUsed?: Date;

    public toWebPushSubscription() {
        return {
            endpoint: this.endpoint,
            keys: {
                p256dh: this.p256dh,
                auth: this.auth
            }
        };
    }
}