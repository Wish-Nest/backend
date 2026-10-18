import {EntityRepository} from "@mikro-orm/sqlite";
import {PushSubscription} from "./push-subscription.entity.js";
import orm from "../../common/orm/orm.js";

export class PushSubscriptionRepository extends EntityRepository<PushSubscription> {
}

export const pushSubscriptionRepo: PushSubscriptionRepository = orm.em.getRepository(PushSubscription);