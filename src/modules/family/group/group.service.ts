import AsyncLock from "async-lock";
import {groupRepository, groupRequestRepository, groupUserRepository} from "./database/group.repository.js";
import {Reference} from "@mikro-orm/core";
import {User} from "../../user/database/user.entity.js";
import {Family} from "../database/family.entity.js";
import {GiftPrivateData, Group, GroupPrivateData} from "./database/group.entity.js";
import {generateGroupUserKeyPair, GroupUserPrivateKey, GroupUserPublicKey} from "../../common/crypto/group-key.js";
import FamilyService from "../family.service.js";
import UserService from "../../user/user.service.js";
import {Gift} from "../gift/database/gift.entity.js";
import {UserPrivateKey} from "../../common/crypto/user-key.js";

class GroupService {
    private gRepository;
    private guRepository;
    private grRepository;

    constructor() {
        this.gRepository = groupRepository;
        this.guRepository = groupUserRepository;
        this.grRepository = groupRequestRepository;
    }

    public async getGroupByUuid(uuid: string) : Promise<null|Group> {
        const group = await this.gRepository.findOne({
            uuid
        }, {
            populate: ['*']
        });

        if (!group) {
            return null;
        }

        return group;
    }

    public async getGroupsForUser(userUuid: string) : Promise<Group[]> {
        const groupUsers = await this.guRepository.find({
            user: {
                uuid: userUuid
            }
        }, {
            populate: ['group', 'group.*', 'group.family', 'group.target', 'group.group_users']
        });

        return groupUsers.map((gu) => gu.group);
    }

    public async getGroupByTargetUuid(targetUuid: string, familyUuid: string) : Promise<null|Group> {
        const group = await this.gRepository.findOne({
            target: {
                uuid: targetUuid
            },
            family: {
                uuid: familyUuid
            }
        }, {
            populate: ['*']
        });

        if (!group) {
            return null;
        }

        return group;
    }

    public async createGroup(targetUuid: string, familyUuid: string, members: User[] = []) : Promise<Group> {
        const groupKeyPair = await generateGroupUserKeyPair();

        const family = await FamilyService.getFamilyById(familyUuid);
        if(!family) {
            throw new Error("Family not found");
        }

        const group = this.gRepository.create({
            family: Reference.createNakedFromPK(Family, familyUuid),
            target: Reference.createNakedFromPK(User, targetUuid),
            _encrypted_private_data: await groupKeyPair.publicKey.encode(JSON.stringify({})),
            group_users: []
        });

        await Promise.all(members.map(async (member) => {
            const pubKey = await member.getPublicKey();

            return this.guRepository.create({
                user: Reference.createNakedFromPK(User, member.uuid),
                group: group,
                _encrypted_private_key: await groupKeyPair.privateKey.encrypt(pubKey),
                _encrypted_public_key: await groupKeyPair.publicKey.encrypt(pubKey)
            });
        }));


        await this.gRepository.getEntityManager().persistAndFlush(group);

        return group;
    }

    public async tryJoinGroup(targetUuid: string, familyUuid: string, userUuid: string) {
        const group = await this.gRepository.findOne({
            target: {
                uuid: targetUuid
            },
            family: {
                uuid: familyUuid
            }
        }, {
            populate: ['*']
        });

        const user = await UserService.getUserByUUID(userUuid);
        if(!user) {
            throw new Error("User not found");
        }

        if (!group) {
            // group not found, we create a new one
            await this.createGroup(targetUuid, familyUuid, [user]);
        } else {
            // group found, we invite the user
            await this.createGroupRequest(group.uuid, userUuid);
        }
    }

    public async createGroupRequest(groupUuid: string, userUuid: string) {
        await this.grRepository.getEntityManager().persistAndFlush(
            this.grRepository.create({
                group: Reference.createNakedFromPK(Group, groupUuid),
                user: Reference.createNakedFromPK(User, userUuid)
            })
        );
    }

    public async getRequestsByUserAndFamily(userUuid: string, familyUuid: string) {
        const requests = await this.grRepository.find({
            user: {
                uuid: {
                    $ne: userUuid
                }
            },
            group: {
                family: {
                    uuid: familyUuid
                },
                target: {
                    uuid: {
                        $ne: userUuid
                    }
                }
            }
        }, {
            populate: ['*']
        });

        if (!requests) {
            return null;
        }

        return requests;
    }

    public async getRequestByUuid(uuid: string) {
        const request = await this.grRepository.findOne({
            uuid
        }, {
            populate: ['*']
        });

        if (!request) {
            return null;
        }

        return request;
    }

    public async acceptGroupRequest(groupUuid: string, userUuid: string, keypair: [GroupUserPublicKey, GroupUserPrivateKey]) {
        const group = await this.getGroupByUuid(groupUuid);
        if (!group) {
            throw new Error("Group not found");
        }

        const user = await UserService.getUserByUUID(userUuid);
        if (!user) {
            throw new Error("User not found");
        }

        const pubKey = await user.getPublicKey();

        await this.guRepository.getEntityManager().persistAndFlush(
            this.guRepository.create({
                user: user,
                group: group,
                _encrypted_public_key: await keypair[0].encrypt(pubKey),
                _encrypted_private_key: await keypair[1].encrypt(pubKey)
            })
        );
    }

    public async deleteGroupRequest(uuid: string) {
        const request = await this.grRepository.findOne({
            uuid
        }, {
            populate: ['*']
        });

        if (!request) {
            throw new Error("Request not found");
        }

        await this.grRepository.getEntityManager().removeAndFlush(request);
    }

    public async editGroupPrivateData(
        memberUuid: string,
        familyUuid: string,
        userPrivateKey: UserPrivateKey,
        actor: User,
        callback: (data: GroupPrivateData) => GroupPrivateData
    ) : Promise<GroupPrivateData> {
        const lock = new AsyncLock();

        return lock.acquire("group:private_data:" + memberUuid, async () => {
            const group = await this.getGroupByTargetUuid(memberUuid, familyUuid);
            if (!group) {
                throw new Error("Group not found");
            }

            const actorUserMember = await group.getUser(actor.uuid);
            if (!actorUserMember) {
                throw new Error("Actor is not a member of the group");
            }
            const [privateKey, publicKey] = await Promise.all([
                actorUserMember.getPrivateKey(userPrivateKey),
                actorUserMember.getPublicKey(userPrivateKey)
            ]);

            const privateData = await group.getPrivateData(privateKey);
            const newPrivateData = callback(privateData);

            group._encrypted_private_data = await publicKey.encode(JSON.stringify(newPrivateData));
            await this.gRepository.getEntityManager().persistAndFlush(group);

            return newPrivateData;
        })
    }

    public async editGiftPrivateData(
        gift: Gift,
        userPrivateKey: UserPrivateKey,
        actor: User,
        callback: (data: GiftPrivateData) => GiftPrivateData
    ) : Promise<GiftPrivateData> {
        const lock = new AsyncLock();

        // @ts-ignore
        return lock.acquire("gift:private_data:" + gift.uuid, async () => {
            const group = await this.getGroupByTargetUuid(gift.userFamily.user.uuid, gift.userFamily.family.uuid);
            if (!group) {
                throw new Error("Group not found");
            }

            const actorUserMember = await group.getUser(actor.uuid);
            if (!actorUserMember) {
                throw new Error("Actor is not a member of the group");
            }
            const [privateKey, publicKey] = await Promise.all([
                actorUserMember.getPrivateKey(userPrivateKey),
                actorUserMember.getPublicKey(userPrivateKey)
            ]);

            const privateData = await group.getPrivateData(privateKey);
            let giftPrivateData = privateData[gift.uuid];
            if (!giftPrivateData) {
                giftPrivateData = {
                    messages: [],
                    takenBy: null
                };
            }
            privateData[gift.uuid] = callback(giftPrivateData);

            group._encrypted_private_data = await publicKey.encode(JSON.stringify(privateData));
            await this.gRepository.getEntityManager().persistAndFlush(group);

            return privateData[gift.uuid];
        })
    }

}

export default new GroupService();