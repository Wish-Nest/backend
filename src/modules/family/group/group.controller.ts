import {FastifyReply, FastifyRequest} from "fastify";
import FamilyService from "../family.service.js";
import GroupService from "./group.service.js";
import UserService from "../../user/user.service.js";

export async function get_user_requests(req: FastifyRequest<{
    Params: {
        familyId: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {familyId} = req.params;

    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const family = await FamilyService.getFamilyById(familyId);
    if (!family) {
        return reply.status(404).send({error: "Family not found"});
    }

    if (!family.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden"});
    }

    const requests = await GroupService.getRequestsByUserAndFamily(user.uuid, familyId);

    if (!requests) {
        return reply.status(404).send({error: "No requests found"});
    }

    return reply.status(200).send(
        await Promise.all(requests.map((request) => ({
            uuid: request.uuid,
            groupUuid: request.group.uuid,
            originName: request.group.family.getMember(request.user.uuid)?.name,
            targetUuid: request.group.target.uuid,
            targetName: request.group.family.getMember(request.group.target.uuid)?.name,
            familyId: family.uuid
        })))
    );
}

export async function accept_group_request(req: FastifyRequest<{
    Params: {
        familyId: string;
        requestUuid: string;
    }
}>, reply: FastifyReply) {
    const token = req.user;
    const {familyId, requestUuid} = req.params;

    if (!token) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const user = await UserService.getUserByUUID(token.uuid);
    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const privateKey = await user.getPrivateKey(token.derived_key);

    const family = await FamilyService.getFamilyById(familyId);
    if (!family) {
        return reply.status(404).send({error: "Family not found"});
    }

    if (!family.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden"});
    }

    const request = await GroupService.getRequestByUuid(requestUuid);
    if (!request) {
        return reply.status(404).send({error: "Request not found"});
    }

    const group = await GroupService.getGroupByUuid(request.group.uuid);
    if (!group) {
        return reply.status(404).send({error: "Group not found"});
    }

    const groupMember = await group.getUser(user.uuid);
    if (!groupMember) {
        return reply.status(403).send({error: "Forbidden"});
    }

    await GroupService.acceptGroupRequest(group.uuid, request.user.uuid, [
        await groupMember.getPublicKey(privateKey),
        await groupMember.getPrivateKey(privateKey)
    ]);

    await GroupService.deleteGroupRequest(request.uuid);

    return reply.status(200).send({message: "Request accepted"});
}


export async function get_group_data(req: FastifyRequest<{
    Params: {
        familyId: string;
        memberId: string;
    }
}>, reply: FastifyReply) {
    const token = req.user;
    const {familyId, memberId} = req.params;

    if (!token) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const user = await UserService.getUserByUUID(token.uuid);
    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const family = await FamilyService.getFamilyById(familyId);
    if (!family) {
        return reply.status(404).send({error: "Family not found"});
    }
    if (!family.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden"});
    }

    const group = await GroupService.getGroupByTargetUuid(memberId, family.uuid);
    if (!group) {
        return reply.status(404).send({error: "Group not found"});
    }
    console.log(group)
    if (!await group.isMember(user.uuid)){
        return reply.status(403).send({error: "Forbidden, you are not a member of this group"});
    }

    const groupMember = await group.getUser(user.uuid);
    if (!groupMember) {
        return reply.status(403).send({error: "Forbidden"});
    }

    const privKey = await user.getPrivateKey(token.derived_key);
    const groupPrivKey = await groupMember.getPrivateKey(privKey);

    const privData = await group.getPrivateData(groupPrivKey);
    privData.additional_gifts = privData.additional_gifts || [];

    return reply.status(200).send(privData);
}