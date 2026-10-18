import orm from "../../common/orm/orm.js";
import {User} from "./user.entity.js";
import {EntityRepository} from "@mikro-orm/sqlite";

class UserRepository extends EntityRepository<User> {
    public async save(user: User) {
        await this.em.persistAndFlush(user);
    }
}

export default orm.em.getRepository(User) as UserRepository;
