import {FastifyInstance} from "fastify";
import {S} from "fluent-json-schema";
import {
    accept_user_invitation,
    deny_user_invitations,
    get_family_invitation_send,
    get_user_invitations,
    invite_user, remove_family_invitation
} from "./invitation.controller.js";

export default async function family_invitation_plugin(app: FastifyInstance) {
    app.get('/api/user/invitations', {
        preHandler: [app.authenticate],
        schema: {
            response: {
                200: S.array().items(
                    S.object()
                        .prop('uuid', S.string().required())
                        .prop('familyName', S.string().required())
                )
            }
        }
    }, get_user_invitations);

    app.delete('/api/user/invitations/:uuid', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('uuid', S.string().required()),
            response: {
                200: S.object()
                    .prop('message', S.string())
            }
        }
    }, deny_user_invitations)

    app.post('/api/user/invitations/:uuid/accept', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('uuid', S.string().format('uuid').required()),
            body: S.object()
                .prop('username', S.string().required()),
            response: {
                200: S.object()
                    .prop('message', S.string())
            }
        }
    }, accept_user_invitation);

    app.post('/api/family/:familyId/invitations', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('familyId', S.string().required()),
            body: S.object()
                .prop('email', S.string().format(S.FORMATS.EMAIL).required()),
            response: {
                200: S.object()
                    .prop('message', S.string())
            }
        }
    }, invite_user);

    app.get('/api/family/:familyId/invitations', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('familyId', S.string().required()),
            response: {
                200: S.array().items(
                    S.object()
                        .prop('uuid', S.string().required())
                        .prop('email', S.string().format(S.FORMATS.EMAIL).required())
                        .prop('familyUuid', S.string().required())
                )
            }
        }
    }, get_family_invitation_send);

    app.delete('/api/family/:familyId/invitations/:invitationId', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('familyId', S.string().required())
                .prop('invitationId', S.string().required()),
            response: {
                200: S.object()
                    .prop('message', S.string())
            }
        }
    }, remove_family_invitation);
}