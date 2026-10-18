import {familyInvitationRepository} from "./database/invitation.repository.js";
import GroupService from "../group/group.service.js";
import FamilyService from "../family.service.js";
import UserService from "../../user/user.service.js";
import EmailService from "../../email/email.service.js";

export interface IFamilyInvitationService {

}

class FamilyInvitationService implements IFamilyInvitationService {
    private invitationRepository;

    constructor() {
        this.invitationRepository = familyInvitationRepository;
    }

    public async getInvitationsByUserEmail(userEmail: string) {
        const invitations = await this.invitationRepository.find({
            email: userEmail
        }, {
            populate: ['*']
        });

        return await Promise.all(invitations);
    }

    public async getInvitationById(uuid: string) {
        const invitation = await this.invitationRepository.findOne({
            uuid
        }, {
            populate: ['*']
        });

        if (!invitation) {
            return null;
        }

        return invitation;
    }

    public async deleteInvitation(uuid: string) {
        const invitation = await this.invitationRepository.findOne({
            uuid
        });

        if (!invitation) {
            return;
        }

        await this.invitationRepository.getEntityManager().removeAndFlush(invitation);
    }

    public async getInvitationsByFamilyId(familyId: string) {
        const invitations = await this.invitationRepository.find({
            family: {
                uuid: familyId
            }
        }, {
            populate: ['*']
        });

        return await Promise.all(invitations);
    }

    public async acceptInvitation(invitationUuid: string, username: string) {
        const invitation = await this.invitationRepository.findOne({
            uuid: invitationUuid
        });

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        const user = await UserService.getUserByEmail(invitation.email);
        if (!user) {
            throw new Error('User not found');
        }

        const newGroup = await GroupService.createGroup(user.uuid, invitation.family.uuid, invitation.family.members.map(member => member.user));

        for (const member of invitation.family.members) {
            await GroupService.tryJoinGroup(member.user.uuid, newGroup.family.uuid, user.uuid);
        }

        const family = await FamilyService.joinFamily(invitation.family.uuid, user.uuid, username);
        if (!family) {
            throw new Error('Family not found');
        }

        await this.invitationRepository.getEntityManager().removeAndFlush(invitation);
    }

    public async createInvitation(familyId: string, userEmail: string) {
        const family = await FamilyService.getFamilyById(familyId);
        if (!family) {
            throw new Error('Family not found');
        }

        const existingInvitation = await this.invitationRepository.findOne({
            family: family,
            email: userEmail
        });

        if (existingInvitation) {
            throw new Error('Invitation already exists');
        }

        const invitation = this.invitationRepository.create({
            family: family,
            email: userEmail
        });

        await this.invitationRepository.getEntityManager().persistAndFlush(invitation);

        await EmailService.sendMail(
            userEmail,
            "WishNest - Invitation à rejoindre la famille \"" + family.name + "\"",
            `<p>Bonjour,</p>
            <p>Vous avez été invité à rejoindre la famille "<strong>${family.name}</strong>" sur WishNest.</p>
            <p>Si vous n'avez pas encore de compte, vous pouvez en créer un en cliquant sur le lien suivant : <a href="https://www.wishnest.ovh/register">Créer un compte</a>.</p>
            <p>Si vous avez déjà un compte, vous pouvez accepter l'invitation en vous connectant à votre compte sur WishNest.</p>
            <p>L'équipe WishNest</p>`
        );

        return invitation;
    }
}

export default new FamilyInvitationService();