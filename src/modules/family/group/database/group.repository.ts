import {EntityRepository} from "@mikro-orm/sqlite";
import orm from "../../../common/orm/orm.js";
import {Group, GroupRequest, GroupUser} from "./group.entity.js";

class GroupRepository extends EntityRepository<Group> {
    public async save(group: Group) {
        await this.em.persistAndFlush(group);
    }
}

export const groupRepository: GroupRepository = orm.em.getRepository(Group);

class GroupUserRepository extends EntityRepository<GroupUser> {
    public async save(groupUser: GroupUser) {
        await this.em.persistAndFlush(groupUser);
    }
}

export const groupUserRepository: GroupUserRepository = orm.em.getRepository(GroupUser);

class GroupRequestRepository extends EntityRepository<GroupRequest> {
    public async save(groupRequest: GroupRequest) {
        await this.em.persistAndFlush(groupRequest);
    }
}

export const groupRequestRepository: GroupRequestRepository = orm.em.getRepository(GroupRequest);