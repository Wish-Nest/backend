import {FastifyInstance} from "fastify";
import {S} from "fluent-json-schema";
import {create_family, get_family, get_user_families, create_virtual_member, rename_member, set_member_priority, set_member_image} from "./family.controller.js";
import family_invitation_plugin from "./invitation/invitation.plugin.js";
import family_group_plugin from "./group/group.plugin.js";
import family_gift_plugin from "./gift/gift.plugin.js";

export default async function family_plugin(app: FastifyInstance) {
    app.register(family_invitation_plugin);
    app.register(family_group_plugin);
    app.register(family_gift_plugin);

    app.get('/api/family', {
        preHandler: [app.authenticate],
        schema: {
            response: {
                200: S.array().items(
                    S.object()
                        .prop('uuid', S.string().required())
                        .prop('name', S.string().required())
                )
            }
        }
    }, get_user_families);

    app.post('/api/family', {
        preHandler: [app.authenticate],
        schema: {
            body: S.object()
                .prop('familyName', S.string().required())
                .prop('username', S.string().required()),
            response: {
                200: S.object()
                    .prop('uuid', S.string().required())
                    .prop('name', S.string().required())
            }
        }
    }, create_family)

    app.get('/api/family/:familyId', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('familyId', S.string().required()),
            response: {
                200: S.object()
                    .prop('uuid', S.string().required())
                    .prop('name', S.string().required())
                    .prop('members', S.array().items(
                        S.object()
                            .prop('uuid', S.string().required())
                            .prop('userUuid', S.string().required())
                            .prop('name', S.string().required())
                            .prop('virtual', S.boolean().required())
                            .prop('priorityEnabled', S.boolean().required())
                            .prop('image', S.anyOf([S.string(), S.null()]))
                    ))
            }
        }
    }, get_family)

    // Renommer un membre : soi-même, ou un membre dont la liste est gérée par la famille (peu importe qui l'a créé)
    app.put('/api/familymember/:memberUuid/name', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('memberUuid', S.string().required()),
            body: S.object()
                .prop('name', S.string().minLength(1).maxLength(64).required()),
            response: {
                200: S.object()
                    .prop('uuid', S.string().required())
                    .prop('userUuid', S.string().required())
                    .prop('name', S.string().required())
                    .prop('virtual', S.boolean().required())
            }
        }
    }, rename_member)

    // Activer / désactiver l'ordonnancement par priorité de sa propre liste
    app.put('/api/familymember/:memberUuid/priority', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('memberUuid', S.string().required()),
            body: S.object()
                .prop('enabled', S.boolean().required()),
            response: {
                200: S.object()
                    .prop('uuid', S.string().required())
                    .prop('priorityEnabled', S.boolean().required())
            }
        }
    }, set_member_priority)

    // Image de profil d'un membre (soi-même, ou un membre « liste gérée » pour
    // n'importe quel membre de la famille). L'upload se fait via POST /api/upload.
    app.put('/api/familymember/:memberUuid/image', {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop('memberUuid', S.string().required()),
            body: S.object()
                .prop('image', S.anyOf([S.string(), S.null()]).required()),
            response: {
                200: S.object()
                    .prop('uuid', S.string().required())
                    .prop('image', S.anyOf([S.string(), S.null()]))
            }
        }
    }, set_member_image)

    // Route pour créer un membre dont la liste sera gérée par la famille
    app.post('/api/family/virtual-member', {
        preHandler: [app.authenticate],
        schema: {
            body: S.object()
                .prop('familyId', S.string().required())
                .prop('username', S.string().required())
                .prop('email', S.string()),
            response: {
                200: S.object()
                    .prop('family', S.object()
                        .prop('uuid', S.string().required())
                        .prop('name', S.string().required())
                    )
                    .prop('user', S.object()
                        .prop('uuid', S.string().required())
                        .prop('email', S.string().required())
                    )
                    .prop('member', S.object()
                        .prop('uuid', S.string().required())
                        .prop('name', S.string().required())
                    )
            }
        }
    }, create_virtual_member)
}