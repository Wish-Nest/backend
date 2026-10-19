import {Family, UserFamily} from "./database/family.entity.js";
import {familyRepository, userFamilyRepository} from "./database/family.repository.js";
import {Reference} from "@mikro-orm/core";
import {User} from "../user/database/user.entity.js";
import PushService from "../push/push.service.js";
import UserService from "../user/user.service.js";
import GroupService from "./group/group.service.js";

export interface IFamilyService {
    getFamiliesByUserId(userId: string): Promise<Family[]>;

    getFamilyByName(familyName: string): Promise<null | Family>;
}

class FamilyService implements IFamilyService {
    private familyRepository;
    private userFamilyRepository;

    constructor() {
        this.familyRepository = familyRepository;
        this.userFamilyRepository = userFamilyRepository;
    }

    public async getFamiliesByUserId(userId: string) : Promise<Family[]> {
        const userFamilies = await this.userFamilyRepository.find({
            user: {
                uuid: userId
            }
        }, {
            populate: ['*']
        });

        const families = userFamilies.map((userFamily) => userFamily.family);

        return await Promise.all(families);
    }

    public async getFamilyByName(familyName: string) {
        const family = await this.familyRepository.findOne({
            name: familyName
        }, {
            populate: ['*']
        });

        if (!family) {
            return null;
        }

        return family;
    }

    public async getFamilyById(familyId: string) {
        const family = await this.familyRepository.findOne({
            uuid: familyId
        }, {
            populate: ['*']
        });

        if (!family) {
            return null;
        }

        return family;
    }

    public async createFamily(familyName: string, userId: string, username: string) {
        const family = new Family();
        family.name = familyName;

        const userFamily = this.userFamilyRepository.create({
            user: Reference.createNakedFromPK(User, userId),
            family,
            name: username,
            priorityEnabled: true
        });

        await this.familyRepository.getEntityManager().persistAndFlush(family);
        await this.userFamilyRepository.getEntityManager().persistAndFlush(userFamily);

        return family;
    }

    public async joinFamily(familyId: string, userId: string, username: string) {
        const family = await this.familyRepository.findOne({
            uuid: familyId
        }, {
            populate: ['*']
        });

        if (!family) {
            return null;
        }

        const userFamily = this.userFamilyRepository.create({
            user: Reference.createNakedFromPK(User, userId),
            family,
            name: username,
            priorityEnabled: true
        });

        await this.userFamilyRepository.getEntityManager().persistAndFlush(userFamily);

        // Après l'ajout du membre, prévenir les autres membres via notification push
        try {
            // Re-charger la famille pour obtenir la liste à jour des membres
            const refreshedFamily = await this.getFamilyById(family.uuid);
            if (refreshedFamily) {
                const memberUuids = refreshedFamily.members.getItems().map(m => m.user.uuid).filter(u => u !== userId);

                if (memberUuids.length > 0) {
                    await PushService.sendNotificationToUsers(memberUuids, {
                        title: `Nouvel arrivant dans la famille "${family.name}"`,
                        body: `${username} a rejoint la famille. Vous avez peut-être des demandes d'adhésion à approuver.`,
                        data: {
                            url: `/families/${family.uuid}`
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to send family join notification:', error);
        }

        return family;
    }

    public async getMemberOfFamilyByUuid(memberUuid: string) {
        const userFamily = await this.userFamilyRepository.findOne({
            uuid: memberUuid
        }, {
            populate: ['*', 'family', 'family.members', 'family.members.*']
        });

        if (!userFamily) {
            return null;
        }

        return userFamily;
    }

    // Renomme le nom d'affichage d'un membre dans une famille (le nom est propre à la famille).
    public async renameFamilyMember(member: UserFamily, name: string) {
        member.name = name;

        await this.userFamilyRepository.getEntityManager().persistAndFlush(member);

        return member;
    }

    // Active ou désactive l'ordonnancement par priorité de la liste d'un membre.
    // Le réglage est serveur : il s'applique à toutes les vues de la liste.
    public async setPriorityEnabled(member: UserFamily, enabled: boolean) {
        member.priorityEnabled = enabled;

        await this.userFamilyRepository.getEntityManager().persistAndFlush(member);

        return member;
    }

    // Change l'image de profil d'un membre au sein de la famille (null = retrait).
    public async setMemberImage(member: UserFamily, image: string | null) {
        member.image = image;

        await this.userFamilyRepository.getEntityManager().persistAndFlush(member);

        return member;
    }

    // Nouvelle méthode: créer un membre dont la liste sera gérée par la famille
    // (utilisateur fictif sans accès + ajout à la famille)
    public async createVirtualMember(familyId: string, username: string, email?: string) {
        const family = await this.familyRepository.findOne({ uuid: familyId }, { populate: ['*'] });
        if (!family) {
            return null;
        }

        // Créer l'utilisateur factice
        const user = await UserService.createFakeUser(email);
        if (!user) {
            return null;
        }

        const userFamily = this.userFamilyRepository.create({
            user: Reference.createNakedFromPK(User, user.uuid),
            family,
            name: username,
            priorityEnabled: true
        });

        await this.userFamilyRepository.getEntityManager().persistAndFlush(userFamily);


        await GroupService.createGroup(user.uuid, family.uuid, family.members.map(member => member.user));

        // Notifier les autres membres
        try {
            const refreshedFamily = await this.getFamilyById(family.uuid);
            if (refreshedFamily) {
                const memberUuids = refreshedFamily.members.getItems().map(m => m.user.uuid).filter(u => u !== user.uuid);

                if (memberUuids.length > 0) {
                    await PushService.sendNotificationToUsers(memberUuids, {
                        title: `Nouveau membre dans la famille "${family.name}"`,
                        body: `${username} a été ajouté(e) à la famille.`,
                        data: {
                            url: `/families/${family.uuid}`
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to send virtual member notification:', error);
        }

        return {
            family,
            user,
            member: userFamily
        };
    }
}

export default new FamilyService();