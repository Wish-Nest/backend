import {EntityRepository} from "@mikro-orm/sqlite";
import {PushNotification} from "./push-notification.entity.js";
import orm from "../../common/orm/orm.js";

export class PushNotificationRepository extends EntityRepository<PushNotification> {
}

export const pushNotificationRepo: PushNotificationRepository = orm.em.getRepository(PushNotification);

