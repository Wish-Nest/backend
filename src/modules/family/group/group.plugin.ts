import {FastifyInstance} from "fastify";
import {S} from "fluent-json-schema";
import {accept_group_request, get_group_data, get_user_requests} from "./group.controller.js";

export default async function family_group_plugin(app: FastifyInstance) {
    app.get("/api/family/:familyId/groups/requests", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("familyId", S.string().required()),
            response: {
                200: S.array().items(
                    S.object()
                        .prop("uuid", S.string().required())
                        .prop("groupUuid", S.string().required())
                        .prop("originName", S.string().required())
                        .prop("originUuid", S.string().required())
                        .prop("targetUuid", S.string().required())
                        .prop("targetName", S.string().required())
                        .prop("familyId", S.string().required())
                )
            }
        }
    }, get_user_requests)

    app.post("/api/family/:familyId/groups/requests/:requestUuid/accept", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("familyId", S.string().required())
                .prop("requestUuid", S.string().required()),
            response: {
                200: S.object()
                    .prop("message", S.string())
            }
        }
    }, accept_group_request);

    app.get("/api/family/:familyId/member/:memberId/privatedata", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("familyId", S.string().required())
                .prop("memberId", S.string().required()),
            response: {
                200: S.object()
                    .patternProperties({
                        "^[0-9a-fA-F-]{36}$": S.object()
                            .prop("messages", S.array().items(
                                S.object()
                                    .prop("content", S.string().required())
                                    .prop("timestamp", S.string().required())
                                    .prop("user_uuid", S.string().required())
                            ))
                            .prop("takenBy", S.anyOf([S.string(), S.null()]))
                    })
                    .prop("additional_gifts", S.array().items(
                        S.object().additionalProperties(true)
                    ))
            }
        }
    }, get_group_data)
}