import {EntityRepository} from "@mikro-orm/sqlite";
import {FamilyInvitation} from "./invitation.entity.js";
import orm from "../../../common/orm/orm.js";

class FamilyInvitationRepository extends EntityRepository<FamilyInvitation> {
    public async save(invitation: FamilyInvitation) {
        await this.em.persistAndFlush(invitation);
    }
}

export const familyInvitationRepository: FamilyInvitationRepository = orm.em.getRepository(FamilyInvitation);