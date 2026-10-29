import {FastifyReply, FastifyRequest} from "fastify";
import FamilyService from "../family.service.js";
import GiftService from "./gift.service.js";
import GroupService from "../group/group.service.js";
import UserService from "../../user/user.service.js";
import {PrivateGiftPrivateData} from "../group/database/group.entity.js";

// Les entités utilisent `uuidv4` : format 8-4-4-4-12 hexadécimal.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function get_member_gifts(req: FastifyRequest<{
    Params: {
        memberUuid: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {memberUuid} = req.params;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const member = await FamilyService.getMemberOfFamilyByUuid(memberUuid);
    if (!member) {
        return reply.status(404).send({error: "Member not found"});
    }
    if (!member.family.isMember(user.uuid)) {
        return reply.status(403).send({error: "Forbidden"});
    }

    const gifts = await GiftService.getGiftByMemberUuid(memberUuid);
    if (!gifts) {
        return reply.status(400).send({error: "Failed to retrieve gifts"});
    }

    return reply.status(200).send(
        await Promise.all(gifts.map((gift) => ({
            uuid: gift.uuid,
            title: gift.title,
            content: gift.content,
            additionalLinks: gift.additional_links ?? [],
            image: (gift as any).image ?? null
        })))
    );
}

export async function reorder_member_gifts(req: FastifyRequest<{
    Params: {
        memberUuid: string;
    },
    Body: {
        giftUuids: string[];
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {memberUuid} = req.params;
    const giftUuids = req.body?.giftUuids;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    // Fastify coerce les scalaires en tableau (coerceTypes: 'array'), on vérifie donc
    // explicitement qu'on a bien un tableau d'uuids avant d'aller plus loin.
    if (!Array.isArray(giftUuids) || giftUuids.some((uuid) => typeof uuid !== 'string' || !UUID_PATTERN.test(uuid))) {
        return reply.status(400).send({error: "Bad parameter: giftUuids must be an array of uuids"});
    }

    const member = await FamilyService.getMemberOfFamilyByUuid(memberUuid);
    if (!member) {
        return reply.status(404).send({error: "Member not found"});
    }

    // Seul le propriétaire de la liste peut définir l'ordre de priorité de ses cadeaux
    if (member.user.uuid !== user.uuid) {
        return reply.status(403).send({error: "Forbidden, only the list owner can reorder gifts"});
    }

    const gifts = await GiftService.reorderGifts(memberUuid, giftUuids);

    return reply.status(200).send(
        gifts.map((gift) => ({
            uuid: gift.uuid,
            title: gift.title,
            content: gift.content,
            additionalLinks: gift.additional_links ?? [],
            image: (gift as any).image ?? null
        }))
    );
}

export async function create_member_gift(req: FastifyRequest<{
    Params: {
        memberUuid: string;
    },
    Body: {
        title: string;
        content?: string;
        additionalLinks?: string[];
        image?: string | null;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {memberUuid} = req.params;
    const {title, content, additionalLinks, image} = req.body;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const member = await FamilyService.getMemberOfFamilyByUuid(memberUuid);
    if (!member) {
        return reply.status(403).send({error: "Forbidden"});
    }

    const gift = await GiftService.createGift(memberUuid, title, content ?? '', additionalLinks ?? [], image ?? undefined);
    if (!gift) {
        return reply.status(400).send({error: "Failed to create gift"});
    }

    // if image is provided (could be null to request deletion) update the gift to store it
    if (typeof image !== 'undefined') {
        try {
            const updatedWithImage = await GiftService.editGift(gift.uuid, gift.title, gift.content, gift.additional_links ?? [], image);
            if (!updatedWithImage) {
                req.log.error('Failed to update gift image: editGift returned null');
                return reply.status(500).send({ error: 'Failed to save image on gift' });
            }
            return reply.status(201).send({
                uuid: updatedWithImage.uuid,
                title: updatedWithImage.title,
                content: updatedWithImage.content,
                additionalLinks: updatedWithImage.additional_links ?? [],
                image: (updatedWithImage as any).image ?? null
            });
        } catch (err) {
            req.log.error(err);
            return reply.status(500).send({ error: 'Failed to save image on gift' });
        }
    }

    return reply.status(201).send({
        uuid: gift.uuid,
        title: gift.title,
        content: gift.content,
        additionalLinks: gift.additional_links ?? [],
        image: (gift as any).image ?? null
    });
}

export async function edit_gift(req: FastifyRequest<{
    Params: {
        giftUuid: string;
    },
    Body: {
        title: string;
        content?: string;
        additionalLinks?: string[];
        image?: string | null;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {giftUuid} = req.params;
    const {title, content, additionalLinks, image} = req.body;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    let gift = await GiftService.getGiftById(giftUuid);
    let privateGift = false;
    if (!gift) {
        gift = await GiftService.findPrivateGiftInUser(giftUuid, user.uuid, user.derived_key);
        privateGift = true;

        if(!gift){
            return reply.status(404).send({error: "Gift not found"});
        }
    }

    let updatedGift;
    if(!privateGift){
        if (gift.userFamily.user.uuid !== user.uuid) {
            return reply.status(403).send({error: "Forbidden"});
        }

        updatedGift = await GiftService.editGift(giftUuid, title, content ?? '', additionalLinks ?? [], image);
        if (!updatedGift) {
            return reply.status(400).send({error: "Failed to update gift"});
        }
    }else{
        if ((gift as PrivateGiftPrivateData).byUserUuid !== user.uuid) {
            return reply.status(403).send({error: "Forbidden"});
        }

        const userEntity = await UserService.getUserByUUID(user.uuid);
        if (!userEntity) {
            return reply.status(404).send({error: "User not found"});
        }
        const userPrivateKey = await userEntity.getPrivateKey(user.derived_key);

        updatedGift = await GiftService.editPrivateGift(gift as PrivateGiftPrivateData, title, content ?? '', userPrivateKey, userEntity, additionalLinks ?? [], image);
    }

    return reply.status(200).send({
        uuid: updatedGift.uuid,
        title: updatedGift.title,
        content: updatedGift.content,
        additionalLinks: (updatedGift as any).additional_links ?? [],
        image: (updatedGift as any).image ?? null
    });
}

export async function delete_gift(req: FastifyRequest<{
    Params: {
        giftUuid: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {giftUuid} = req.params;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }


    let gift = await GiftService.getGiftById(giftUuid);
    let privateGift = false;
    if (!gift) {
        gift = await GiftService.findPrivateGiftInUser(giftUuid, user.uuid, user.derived_key);
        privateGift = true;

        if(!gift){
            return reply.status(404).send({error: "Gift not found"});
        }
    }

    if(!privateGift){
        if (gift.userFamily.user.uuid !== user.uuid) {
            return reply.status(403).send({error: "Forbidden"});
        }

        const deleted = await GiftService.deleteGift(giftUuid);
        if (!deleted) {
            return reply.status(400).send({error: "Failed to delete gift"});
        }
    }else{
        if ((gift as PrivateGiftPrivateData).byUserUuid !== user.uuid) {
            return reply.status(403).send({error: "Forbidden"});
        }

        const userEntity = await UserService.getUserByUUID(user.uuid);
        if (!userEntity) {
            return reply.status(404).send({error: "User not found"});
        }
        const userPrivateKey = await userEntity.getPrivateKey(user.derived_key);

        await GiftService.deletePrivateGift(gift as PrivateGiftPrivateData, userPrivateKey, userEntity);
    }

    return reply.status(204).send();
}

export async function accept_gift(req: FastifyRequest<{
    Params: {
        giftUuid: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {giftUuid} = req.params;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    let gift = await GiftService.getGiftById(giftUuid);
    if (!gift) {
        gift = await GiftService.findPrivateGiftInUser(giftUuid, user.uuid, user.derived_key);
        if(!gift){
            return reply.status(404).send({error: "Gift not found"});
        }
    }

    if(!gift.userFamily.family.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden"});
    }

    const group = await GroupService.getGroupByTargetUuid(gift.userFamily.user.uuid, gift.userFamily.family.uuid);
    if (!group) {
        return reply.status(404).send({error: "Group not found"});
    }
    if (!await group.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden, you are not a member of this group"});
    }

    const userEntity = await UserService.getUserByUUID(user.uuid);
    if (!userEntity) {
        return reply.status(404).send({error: "User not found"});
    }
    const userPrivateKey = await userEntity.getPrivateKey(user.derived_key);

    try {
        await GiftService.acceptGift(gift, userPrivateKey, userEntity);
    } catch (error) {
        console.error("Error accepting gift:", error);
        return reply.status(500).send({error: "Failed to accept gift"});
    }

    return reply.status(200).send({
        message: "Gift accepted successfully"
    });
}

export async function deny_gift(req: FastifyRequest<{
    Params: {
        giftUuid: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {giftUuid} = req.params;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    let gift = await GiftService.getGiftById(giftUuid);
    if (!gift) {
        gift = await GiftService.findPrivateGiftInUser(giftUuid, user.uuid, user.derived_key);
        if(!gift){
            return reply.status(404).send({error: "Gift not found"});
        }
    }

    if(!gift.userFamily.family.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden"});
    }

    const group = await GroupService.getGroupByTargetUuid(gift.userFamily.user.uuid, gift.userFamily.family.uuid);
    if (!group) {
        return reply.status(404).send({error: "Group not found"});
    }
    if (!await group.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden, you are not a member of this group"});
    }

    const userEntity = await UserService.getUserByUUID(user.uuid);
    if (!userEntity) {
        return reply.status(404).send({error: "User not found"});
    }
    const userPrivateKey = await userEntity.getPrivateKey(user.derived_key);

    const actorUserMember = await group.getUser(user.uuid);
    if (!actorUserMember) {
        return reply.status(403).send({error: "Forbidden, you are not a member of this group"});
    }
    const [privateKey] = await Promise.all([
        actorUserMember.getPrivateKey(userPrivateKey)
    ]);

    const groupPrivateData = await group.getPrivateData(privateKey);
    const giftPrivateData = groupPrivateData[gift.uuid];
    if(!giftPrivateData) {
        return reply.status(404).send({error: "Gift private data not found"});
    }
    if (giftPrivateData.takenBy !== user.uuid) {
        return reply.status(403).send({error: "Forbidden, you are not the one who took this gift"});
    }

    try {
        await GiftService.denyGift(gift, userPrivateKey, userEntity);
    } catch (error) {
        console.error("Error denying gift:", error);
        return reply.status(500).send({error: "Failed to deny gift"});
    }

    return reply.status(200).send({
        message: "Gift denied successfully"
    });
}

export async function add_message(req: FastifyRequest<{
    Params: {
        giftUuid: string;
    },
    Body: {
        message: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {giftUuid} = req.params;
    const {message} = req.body;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    let gift = await GiftService.getGiftById(giftUuid);
    if (!gift) {
        gift = await GiftService.findPrivateGiftInUser(giftUuid, user.uuid, user.derived_key);
        if(!gift){
            return reply.status(404).send({error: "Gift not found"});
        }
    }

    if (!gift.userFamily.family.isMember(user.uuid)) {
        return reply.status(403).send({error: "Forbidden"});
    }

    const group = await GroupService.getGroupByTargetUuid(gift.userFamily.user.uuid, gift.userFamily.family.uuid);
    if (!group) {
        return reply.status(404).send({error: "Group not found"});
    }
    if (!await group.isMember(user.uuid)) {
        return reply.status(403).send({error: "Forbidden, you are not a member of this group"});
    }

    const userEntity = await UserService.getUserByUUID(user.uuid);
    if (!userEntity) {
        return reply.status(404).send({error: "User not found"});
    }
    const userPrivateKey = await userEntity.getPrivateKey(user.derived_key);

    const actorUserMember = await group.getUser(user.uuid);
    if (!actorUserMember) {
        return reply.status(403).send({error: "Forbidden, you are not a member of this group"});
    }

    try {
        await GiftService.addMessage(gift, userPrivateKey, userEntity, message);
    } catch (error) {
        console.error("Error sending message:", error);
        return reply.status(500).send({error: "Failed to send message"});
    }

    return reply.status(200).send({
        message: "Message send successfully"
    });
}

export async function create_private_gift(req: FastifyRequest<{
    Params: {
        memberUuid: string;
    },
    Body: {
        title: string;
        content?: string;
        additionalLinks?: string[];
        image?: string | null;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {memberUuid} = req.params;
    const {title, content, additionalLinks, image} = req.body;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const member = await FamilyService.getMemberOfFamilyByUuid(memberUuid);
    if (!member) {
        return reply.status(403).send({error: "Forbidden"});
    }

    const group = await GroupService.getGroupByTargetUuid(member.user.uuid, member.family.uuid);
    if (!group) {
        return reply.status(404).send({error: "Group not found"});
    }
    if (!await group.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden, you are not a member of this group"});
    }

    const userEntity = await UserService.getUserByUUID(user.uuid);
    if (!userEntity) {
        return reply.status(404).send({error: "User not found"});
    }
    const userPrivateKey = await userEntity.getPrivateKey(user.derived_key);

    try {
        await GiftService.createPrivateGift(member, title, content === undefined ? null : content, userEntity, userPrivateKey, additionalLinks ?? [], image ?? undefined);
    } catch (err) {
        console.error("Error creating private gift:", err);
        return reply.status(500).send({ error: 'Failed to create private gift' });
    }

    return reply.status(201).send({ message: 'ok' });
}

export async function get_taken_gifts(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user;
    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    try {
        const takenGifts = await GiftService.getGiftsTakenByUser(user.uuid, user.derived_key);
        return reply.status(200).send(takenGifts);
    } catch (error) {
        console.error("Error fetching taken gifts:", error);
        return reply.status(500).send({error: "Failed to fetch taken gifts"});
    }
}