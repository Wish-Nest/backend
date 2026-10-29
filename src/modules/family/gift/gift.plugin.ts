import {FastifyInstance} from "fastify";
import {S} from "fluent-json-schema";
import {
    accept_gift,
    add_message,
    create_member_gift, create_private_gift,
    delete_gift,
    deny_gift,
    edit_gift,
    get_member_gifts,
    reorder_member_gifts
} from "./gift.controller.js";

export default async function family_gift_plugin(app: FastifyInstance) {
    app.get("/api/familymember/:memberUuid/gift", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("memberUuid", S.string().required()),
            response: {
                200: S.array().items(
                    S.object()
                        .prop("uuid", S.string().required())
                        .prop("title", S.string().required())
                        .prop("content", S.string().required())
                        .prop("additionalLinks", S.array().items(S.string()))
                        .prop("image", S.anyOf([S.string(), S.null()]))
                )
            }
        }
    }, get_member_gifts)

    app.put("/api/familymember/:memberUuid/gift/order", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("memberUuid", S.string().required()),
            body: S.object()
                .prop("giftUuids", S.array().items(S.string()).required()),
            response: {
                200: S.array().items(
                    S.object()
                        .prop("uuid", S.string().required())
                        .prop("title", S.string().required())
                        .prop("content", S.string().required())
                        .prop("additionalLinks", S.array().items(S.string()))
                        .prop("image", S.anyOf([S.string(), S.null()]))
                )
            }
        }
    }, reorder_member_gifts)

    app.post("/api/familymember/:memberUuid/gift", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("memberUuid", S.string().required()),
            body: S.object()
                .prop("title", S.string().required())
                .prop("content", S.anyOf([S.string().minLength(0), S.null()]))
                .prop("additionalLinks", S.array().items(S.string()))
                .prop("image", S.anyOf([S.string(), S.null()])),
            response: {
                201: S.object()
                    .prop("uuid", S.string().required())
                    .prop("title", S.string().required())
                    .prop("content", S.anyOf([S.string().minLength(0), S.null()]))
                    .prop("additionalLinks", S.array().items(S.string()))
                    .prop("image", S.anyOf([S.string(), S.null()]))
            }
        }
    }, create_member_gift);

    app.put("/api/gift/:giftUuid", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("giftUuid", S.string().required()),
            body: S.object()
                .prop("title", S.string().required())
                .prop("content", S.anyOf([S.string().minLength(0), S.null()]))
                .prop("additionalLinks", S.array().items(S.string()))
                .prop("image", S.anyOf([S.string(), S.null()])),
            response: {
                200: S.object()
                    .prop("uuid", S.string().required())
                    .prop("title", S.string().required())
                    .prop("content", S.anyOf([S.string(), S.null()]))
                    .prop("additionalLinks", S.array().items(S.string()))
                    .prop("image", S.anyOf([S.string(), S.null()]))
            }
        }
    }, edit_gift);

    app.delete("/api/gift/:giftUuid", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("giftUuid", S.string().required()),
            response: {
                204: S.null()
            }
        }
    }, delete_gift);

    app.post("/api/gift/:giftUuid/accept", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("giftUuid", S.string().required()),
            response: {
                200: S.object()
                    .prop("message", S.string().required())
            }
        }
    }, accept_gift);

    app.post("/api/gift/:giftUuid/deny", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("giftUuid", S.string().required()),
            response: {
                200: S.object()
                    .prop("message", S.string().required())
            }
        }
    }, deny_gift);

    app.post("/api/gift/:giftUuid/messages", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("giftUuid", S.string().required()),
            body: S.object()
                .prop("message", S.string().required()),
            response: {
                200: S.object()
                    .prop("message", S.string().required())
            }
        }
    }, add_message);

    app.post("/api/familymember/:memberUuid/gift/private", {
        preHandler: [app.authenticate],
        schema: {
            params: S.object()
                .prop("memberUuid", S.string().required()),
            body: S.object()
                .prop("title", S.string().required())
                .prop("content", S.anyOf([S.string().minLength(0), S.null()]))
                .prop("additionalLinks", S.array().items(S.string()))
                .prop("image", S.anyOf([S.string(), S.null()])),
            response: {
                201: S.object()
                    .prop("message", S.string().required())
            }
        }
    }, create_private_gift)

    app.get("/api/user/taken-gifts", {
        preHandler: [app.authenticate],
        schema: {
            response: {
                200: S.array().items(
                    S.object()
                        .prop("uuid", S.string().required())
                        .prop("title", S.string().required())
                        .prop("content", S.anyOf([S.string(), S.null()]))
                        .prop("additionalLinks", S.array().items(S.string()))
                        .prop("image", S.anyOf([S.string(), S.null()]))
                        .prop("type", S.string().required())
                        .prop("takenBy", S.anyOf([S.string(), S.null()]))
                        .prop("byUserUuid", S.string())
                        .prop("member", S.object()
                            .prop("uuid", S.string().required())
                            .prop("userUuid", S.string().required())
                            .prop("name", S.string().required()))
                        .prop("family", S.object()
                            .prop("uuid", S.string().required())
                            .prop("name", S.string().required()))
                )
            }
        }
    }, async (req, reply) => {
        const {get_taken_gifts} = await import("./gift.controller.js");
        return get_taken_gifts(req, reply);
    })
}