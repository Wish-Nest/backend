import {giftRepository} from "./database/gift.repository.js";
import {Reference} from "@mikro-orm/core";
import {UserFamily} from "../database/family.entity.js";
import {Gift} from "./database/gift.entity.js";
import {UserPrivateKey} from "../../common/crypto/user-key.js";
import {User} from "../../user/database/user.entity.js";
import GroupService from "../group/group.service.js";
import {uuid} from "uuidv4";
import {PrivateGiftPrivateData} from "../group/database/group.entity.js";
import FamilyService from "../family.service.js";
import UserService from "../../user/user.service.js";
import {DerivedKey} from "../../common/crypto/derived-key.js";
import PushNotificationService from "../../push/push.service.js";

class GiftService {
    private gRepository;

    constructor() {
        this.gRepository = giftRepository;
    }

    async getGiftByMemberUuid(memberUuid: string) {
        const gifts = await this.gRepository.find({
            userFamily: {
                uuid: memberUuid,
            }
        }, {
            populate: ['*'],
            orderBy: {
                position: 'asc',
                uuid: 'asc'
            }
        });

        if (!gifts) {
            return null;
        }

        return gifts;
    }

    async getGiftById(giftId: string) : Promise<Gift|null> {
        const gift = await this.gRepository.findOne({
            uuid: giftId
        }, {
            populate: ['*']
        });

        if (!gift) {
            return null;
        }

        return gift;
    }

    async createGift(memberUuid: string, title: string, content: string, additionalLinks?: string[], image?: string | null) {
        // Place the new gift at the end of the member's priority order
        const lastGifts = await this.gRepository.find({
            userFamily: {
                uuid: memberUuid
            }
        }, {
            orderBy: {
                position: 'desc'
            },
            limit: 1
        });
        const last = lastGifts[0];
        const position = last ? (last.position ?? 0) + 1 : 0;

        const gift = this.gRepository.create({
            title,
            content,
            additional_links: additionalLinks ?? [],
            userFamily: Reference.createNakedFromPK(UserFamily, memberUuid),
            image: image === null ? null : (image ?? undefined),
            position
        });

        await this.gRepository.getEntityManager().persistAndFlush(gift);

        const userFamily = await this.gRepository.getEntityManager().findOne(UserFamily, memberUuid, {
            populate: ['family.members.user']
        });

        if (!userFamily) {
            throw new Error("UserFamily not found");
        }

        PushNotificationService.sendNotificationToGift(gift,
            'Nouveau cadeau ajouté !',
            `${userFamily.name} a ajouté un nouveau cadeau : ${title}`
        );

        return gift;
    }

    async editGift(giftId: string, title: string, content: string, additionalLinks?: string[], image?: string | null) {
        const gift = await this.getGiftById(giftId);
        if (!gift) {
            return null;
        }

        gift.title = title;
        gift.content = content;
        gift.additional_links = additionalLinks ?? [];
        // accept explicit null to remove image
        gift.image = image === null ? null : (image ?? undefined);

        await this.gRepository.getEntityManager().persistAndFlush(gift);

        return gift;
    }

    /**
     * Reordonne les cadeaux publics d'un membre selon l'ordre de priorité fourni.
     * Les cadeaux absents de la liste sont replacés à la fin, dans leur ordre actuel.
     * L'appartenance au membre est vérifiée par l'appelant (contrôleur).
     */
    async reorderGifts(memberUuid: string, orderedUuids: string[]): Promise<Gift[]> {
        const gifts = await this.getGiftByMemberUuid(memberUuid);
        if (!gifts) {
            return [];
        }

        const byUuid = new Map(gifts.map((gift) => [gift.uuid, gift]));

        let position = 0;
        for (const uuid of orderedUuids) {
            const gift = byUuid.get(uuid);
            if (!gift) {
                // cadeau inconnu ou appartenant à un autre membre : ignoré
                continue;
            }
            gift.position = position++;
            byUuid.delete(uuid);
        }

        // cadeaux non mentionnés : on les garde après, dans leur ordre actuel
        for (const gift of gifts) {
            if (byUuid.has(gift.uuid)) {
                gift.position = position++;
            }
        }

        await this.gRepository.getEntityManager().flush();

        return (await this.getGiftByMemberUuid(memberUuid)) ?? [];
    }

    async editPrivateGift(gift: PrivateGiftPrivateData, title: string, content: string, privateKey: UserPrivateKey, actor: User, additionalLinks?: string[], image?: string | null) {
        await GroupService.editGroupPrivateData(gift.userFamily.user.uuid, gift.userFamily.family.uuid, privateKey, actor,
            (data) => {
                data.additional_gifts.forEach((el, index) => {
                    if (el.uuid === gift.uuid) {
                        if(!data.additional_gifts[index]) {
                            return;
                        }
                        data.additional_gifts[index].title = title;
                        data.additional_gifts[index].content = content;
                        data.additional_gifts[index].additional_links = additionalLinks ?? [];
                        data.additional_gifts[index].image = image === null ? null : (image ?? undefined);
                    }
                })

                return data;
            });

        PushNotificationService.sendNotificationToGift(gift,
            'Nouvelle activité privé',
            `Il y a du nouveau du côté du cadeau "${gift.title}"`
        );

        return gift;
    }

    async deleteGift(giftId: string) {
        const gift = await this.getGiftById(giftId);
        if (!gift) {
            return null;
        }

        await this.gRepository.getEntityManager().removeAndFlush(gift);

        const userFamily = gift.userFamily;

        PushNotificationService.sendNotificationToGift(gift,
            'Cadeau supprimé',
            `${userFamily.name} vient de retirer son cadeau "${gift.title}"`,
            `/families/${userFamily.family.uuid}/member/${userFamily.uuid}`
        );

        return gift;
    }

    async deletePrivateGift(gift: PrivateGiftPrivateData, privateKey: UserPrivateKey, actor: User) {
        await GroupService.editGroupPrivateData(gift.userFamily.user.uuid, gift.userFamily.family.uuid, privateKey, actor,
            (data) => {
                const newAdditionalGifts: PrivateGiftPrivateData[] = [];
                data.additional_gifts.forEach(el => {
                    if (el.uuid !== gift.uuid) {
                        newAdditionalGifts.push(el);
                    }
                })
                data.additional_gifts = newAdditionalGifts;
                delete data[gift.uuid];

                return data;
            });

        const actorName = gift.userFamily.family.getMember(actor.uuid)
        const targetName = gift.userFamily.name

        PushNotificationService.sendNotificationToGift(gift,
            'Nouvelle activité privé',
            actorName?.name + ' a supprimé un cadeau du côté de ' + targetName
        );
    }

    async acceptGift(gift: Gift, userPrivateKey: UserPrivateKey, actor: User) {
        await GroupService.editGiftPrivateData(gift, userPrivateKey, actor,
            (data) => {
                data.takenBy = actor.uuid;
                data.messages.push({
                    content: `Je prévois de prendre ce cadeau !`,
                    timestamp: new Date().toISOString(),
                    user_uuid: actor.uuid
                });
                return data;
            });

        PushNotificationService.sendNotificationToGift(gift,
            'Nouvelle activité privé',
            `Il y a du nouveau du côté du cadeau "${gift.title}"`
        );
    }

    async denyGift(gift: Gift, userPrivateKey: UserPrivateKey, actor: User) {
        await GroupService.editGiftPrivateData(gift, userPrivateKey, actor,
            (data) => {
                data.takenBy = null;
                data.messages.push({
                    content: `Je ne prends finalement plus ce cadeau.`,
                    timestamp: new Date().toISOString(),
                    user_uuid: actor.uuid
                });
                return data;
            });

        PushNotificationService.sendNotificationToGift(gift,
            'Nouvelle activité privé',
            `Il y a du nouveau du côté du cadeau "${gift.title}"`
        );
    }

    async addMessage(gift: Gift, userPrivateKey: UserPrivateKey, actor: User, message: string) {
        await GroupService.editGiftPrivateData(gift, userPrivateKey, actor,
            (data) => {
                data.messages.push({
                    content: message,
                    timestamp: new Date().toISOString(),
                    user_uuid: actor.uuid
                });
                return data;
            });

        PushNotificationService.sendNotificationToGift(gift,
            'Nouvelle activité privé',
            `Il y a du nouveau du côté du cadeau "${gift.title}"`
        );
    }

    async createPrivateGift(member: UserFamily, title: string, content: null|string, actor: User, privateKey: UserPrivateKey, additionalLinks?: string[], image?: string | null) {
        const giftUuid = uuid();
        await GroupService.editGroupPrivateData(member.user.uuid, member.family.uuid, privateKey, actor,
            (data) => {
                if(!data.additional_gifts) {
                    data.additional_gifts = [];
                }
                data.additional_gifts.push({
                    uuid: giftUuid,
                    content,
                    title,
                    byUserUuid: actor.uuid,
                    additional_links: additionalLinks ?? [],
                    image: image === null ? null : (image ?? undefined)
                } as PrivateGiftPrivateData);
                return data;
            });

        const gift = await this.findPrivateGiftInUser(giftUuid, actor.uuid, {} as DerivedKey, privateKey)
        if (!gift) {
            throw new Error("Gift not found after creation");
        }

        PushNotificationService.sendNotificationToGift(gift,
            'Nouvelle activité privé',
            `Il y a du nouveau du côté du cadeau "${gift.title}"`
        );
    }

    async findPrivateGiftInUser(giftUuid: string, userUuid: string, derivedKey: DerivedKey, _userPrivateKey: UserPrivateKey | null | undefined = null) : Promise<Gift|null> {
        const families = await FamilyService.getFamiliesByUserId(userUuid);
        const userEntity = await UserService.getUserByUUID(userUuid);
        if (!userEntity) {
            return null;
        }
        const userPrivateKey = _userPrivateKey ?? await userEntity.getPrivateKey(derivedKey);
        for (const family of families) {
            const userMember = family.getMember(userUuid);
            if (!userMember) {
                continue;
            }
            for (const familyMember of family.members) {
                if (familyMember.user.uuid === userUuid) {
                    continue;
                }
                const group = await GroupService.getGroupByTargetUuid(familyMember.user.uuid, familyMember.family.uuid);
                if (!group) {
                    continue;
                }
                const actorUserMember = await group.getUser(userUuid);
                if (!actorUserMember) {
                    continue;
                }
                let privateKey;
                try {
                    [privateKey] = await Promise.all([
                        actorUserMember.getPrivateKey(userPrivateKey)
                    ]);
                } catch (e) {
                    continue;
                }
                const groupPrivateData = await group.getPrivateData(privateKey);
                const giftPrivateData = groupPrivateData.additional_gifts?.find(g => g.uuid === giftUuid);
                if (!giftPrivateData) {
                    continue;
                }
                giftPrivateData.userFamily = familyMember;

                // gift found
                return giftPrivateData;
            }
        }

        return null;
    }

    async getGiftsTakenByUser(userUuid: string, derivedKey: DerivedKey) {
        const userEntity = await UserService.getUserByUUID(userUuid);
        if (!userEntity) {
            return [];
        }
        const userPrivateKey = await userEntity.getPrivateKey(derivedKey);
        const groups = await GroupService.getGroupsForUser(userUuid);
        const takenGifts: any[] = [];

        for (const group of groups) {
            const actorUserMember = await group.getUser(userUuid);
            if (!actorUserMember) {
                continue;
            }
            let privateKey;
            try {
                privateKey = await actorUserMember.getPrivateKey(userPrivateKey);
            } catch (e) {
                continue;
            }
            let groupPrivateData;
            try {
                groupPrivateData = await group.getPrivateData(privateKey);
            } catch (e) {
                continue;
            }

            // `family.members` n'est pas peuplé par getGroupsForUser(). Sans ce
            // chargement explicite, members.getItems() lève une erreur MikroORM
            // ("Collection<UserFamily> ... not initialized").
            const familyMembers = await group.family.members.loadItems({populate: ['user']});
            // Un groupe ne gère que les cadeaux de sa cible : inutile de parcourir
            // les cadeaux des autres membres de la famille.
            const targetMember = familyMembers.find(member => member.user.uuid === group.target.uuid);
            if (!targetMember) {
                continue;
            }

            // Check regular gifts
            const gifts = await this.getGiftByMemberUuid(targetMember.uuid);
            if (gifts) {
                for (const gift of gifts) {
                    const giftPrivate = groupPrivateData[gift.uuid];
                    if (giftPrivate && giftPrivate.takenBy === userUuid) {
                        takenGifts.push({
                            uuid: gift.uuid,
                            title: gift.title,
                            content: gift.content,
                            additionalLinks: gift.additional_links ?? [],
                            image: (gift as any).image ?? null,
                            type: 'public',
                            takenBy: giftPrivate.takenBy,
                            member: {
                                uuid: targetMember.uuid,
                                userUuid: targetMember.user.uuid,
                                name: targetMember.name
                            },
                            family: {
                                uuid: group.family.uuid,
                                name: group.family.name
                            }
                        });
                    }
                }
            }

            // Check private/additional gifts
            const additionalGifts = groupPrivateData.additional_gifts || [];
            for (const additionalGift of additionalGifts) {
                // Check if taken by this user - we need to look up the gift's private data
                const giftPrivate = groupPrivateData[additionalGift.uuid];
                if (giftPrivate && giftPrivate.takenBy === userUuid) {
                    takenGifts.push({
                        uuid: additionalGift.uuid,
                        title: additionalGift.title,
                        content: additionalGift.content,
                        additionalLinks: additionalGift.additional_links ?? [],
                        image: (additionalGift as any).image ?? null,
                        type: 'private',
                        takenBy: giftPrivate.takenBy,
                        byUserUuid: additionalGift.byUserUuid,
                        member: {
                            uuid: targetMember.uuid,
                            userUuid: targetMember.user.uuid,
                            name: targetMember.name
                        },
                        family: {
                            uuid: group.family.uuid,
                            name: group.family.name
                        }
                    });
                }
            }
        }

        return takenGifts;
    }
}

export default new GiftService();