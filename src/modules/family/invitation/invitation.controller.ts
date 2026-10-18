import {FastifyReply, FastifyRequest} from "fastify";
import FamilyInvitationService from "./invitation.service.js";
import FamilyService from "../family.service.js";
import UserService from "../../user/user.service.js";

export async function get_user_invitations(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user;

    if (!user) {
        return reply.status(401).send({
            message: 'Unauthorized'
        });
    }

    const invitations = await FamilyInvitationService.getInvitationsByUserEmail(user.email);

    reply.status(200).send(invitations.map((invitation) => ({
        uuid: invitation.uuid,
        familyName: invitation.family.name
    })))
}

export async function deny_user_invitations(req: FastifyRequest<{
    Params: {
        uuid: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {uuid} = req.params;

    if (!user) {
        return reply.status(401).send({
            message: 'Unauthorized'
        });
    }

    const invitation = await FamilyInvitationService.getInvitationById(uuid);

    if (!invitation) {
        return reply.status(404).send({
            message: 'Invitation not found'
        });
    }

    if (invitation.email !== user.email) {
        return reply.status(403).send({
            message: 'Forbidden'
        });
    }

    await FamilyInvitationService.deleteInvitation(uuid);

    reply.status(200).send({
        message: 'Invitation deleted'
    })
}

export async function accept_user_invitation(req: FastifyRequest<{
    Params: {
        uuid: string;
    },
    Body: {
        username: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {uuid} = req.params;
    const {username} = req.body;

    if (!user) {
        return reply.status(401).send({
            message: 'Unauthorized'
        });
    }

    const invitation = await FamilyInvitationService.getInvitationById(uuid);

    if (!invitation) {
        return reply.status(404).send({
            message: 'Invitation not found'
        });
    }

    if (invitation.email !== user.email) {
        return reply.status(403).send({
            message: 'Forbidden'
        });
    }

    await FamilyInvitationService.acceptInvitation(invitation.uuid, username);

    reply.status(200).send({
        message: 'Invitation accepted'
    })
}

export async function invite_user(req: FastifyRequest<{
    Params: {
        familyId: string;
    },
    Body: {
        email: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {familyId} = req.params;
    const {email} = req.body;

    if (!user) {
        return reply.status(401).send({
            message: 'Unauthorized'
        });
    }

    const family = await FamilyService.getFamilyById(familyId);
    if (!family) {
        return reply.status(404).send({
            message: 'Family not found'
        });
    }

    if (!family.isMember(user.uuid)) {
        return reply.status(403).send({
            message: 'Forbidden'
        });
    }

    const targetUser = await UserService.getUserByEmail(email);
    if (targetUser) {

        if(targetUser.uuid === user.uuid) {
            return reply.status(400).send({
                message: 'You cannot invite yourself'
            });
        }

        if(family.isMember(targetUser.uuid)){
            return reply.status(400).send({
                message: 'User is already a member of the family'
            });
        }
    }



    await FamilyInvitationService.createInvitation(familyId, email);

    reply.status(200).send({
        message: 'Invitation created'
    })
}

export async function get_family_invitation_send(req: FastifyRequest<{
    Params: {
        familyId: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {familyId} = req.params;

    if (!user) {
        return reply.status(401).send({
            message: 'Unauthorized'
        });
    }

    const family = await FamilyService.getFamilyById(familyId);
    if (!family) {
        return reply.status(404).send({
            message: 'Family not found'
        });
    }

    if (!family.isMember(user.uuid)) {
        return reply.status(403).send({
            message: 'Forbidden'
        });
    }

    const invitations = await FamilyInvitationService.getInvitationsByFamilyId(familyId);

    reply.status(200).send(invitations.map((invitation) => ({
        uuid: invitation.uuid,
        email: invitation.email,
        familyUuid: invitation.family.uuid
    })))

}

export async function remove_family_invitation(req: FastifyRequest<{
    Params: {
        familyId: string;
        invitationId: string;
    }
}>, reply: FastifyReply) {
    const user = req.user;
    const {familyId, invitationId} = req.params;

    if (!user) {
        return reply.status(401).send({
            message: 'Unauthorized'
        });
    }

    const family = await FamilyService.getFamilyById(familyId);
    if (!family) {
        return reply.status(404).send({
            message: 'Family not found'
        });
    }

    if (!family.isMember(user.uuid)) {
        return reply.status(403).send({
            message: 'Forbidden'
        });
    }

    const invitation = await FamilyInvitationService.getInvitationById(invitationId);
    if (!invitation) {
        return reply.status(404).send({
            message: 'Invitation not found'
        });
    }

    if (invitation.family.uuid !== familyId) {
        return reply.status(403).send({
            message: 'Forbidden'
        });
    }

    await FamilyInvitationService.deleteInvitation(invitationId);

    reply.status(200).send({
        message: 'Invitation deleted'
    });
}