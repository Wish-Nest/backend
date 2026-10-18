import {EntityRepository} from "@mikro-orm/sqlite";
import orm from "../../../common/orm/orm.js";
import {Gift} from "./gift.entity.js";

class GiftRepository extends EntityRepository<Gift> {
    public async save(gift: Gift) {
        await this.em.persistAndFlush(gift);
    }
}

export const giftRepository: GiftRepository = orm.em.getRepository(Gift);
