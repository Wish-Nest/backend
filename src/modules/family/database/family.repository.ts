import orm from "../../common/orm/orm.js";
import {EntityRepository} from "@mikro-orm/sqlite";
import {Family, UserFamily} from "./family.entity.js";

class FamilyRepository extends EntityRepository<Family> {
    public async save(family: Family) {
        await this.em.persistAndFlush(family);
    }
}

export const familyRepository: FamilyRepository = orm.em.getRepository(Family);

class UserFamilyRepository extends EntityRepository<UserFamily> {
    public async save(userFamily: UserFamily) {
        await this.em.persistAndFlush(userFamily);
    }
}

export const userFamilyRepository: UserFamilyRepository = orm.em.getRepository(UserFamily);