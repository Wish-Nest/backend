import {FastifyInstance} from "fastify";
import {S} from "fluent-json-schema";
import {add_user, login, verify} from "./user.controller.js";

export default async function user_plugin(app: FastifyInstance) {
    app.post("/api/user", {
        schema: {
            body: S.object()
                .prop("email", S.string().required())
                .prop("password", S.string().required()),
            response: {
                200: S.object()
                    .prop("email", S.string().required())
                    .prop("uuid", S.string().required()),
                400: S.ref("error#"),
                500: S.ref("error#")
            }
        },
    }, add_user);

    app.post("/api/user/login", {
        schema: {
            body: S.object()
                .prop("email", S.string().required())
                .prop("password", S.string().required()),
            response: {
                200: S.object()
                    .prop("verified", S.boolean().required())
                    .prop("email", S.string().required())
                    .prop("uuid", S.string().required())
                    .prop("jwt", S.string().required()),
                400: S.ref("error#"),
                500: S.ref("error#")
            }
        },
    }, login);

    app.post("/api/user/verify", {
        schema: {
            body: S.object()
                .prop("uuid", S.string().required())
                .prop("code", S.string().required()),
            response: {
                200: S.object()
                    .prop("email", S.string().required())
                    .prop("uuid", S.string().required()),
                400: S.ref("error#"),
                404: S.ref("error#"),
                500: S.ref("error#")
            }
        },
    }, verify);
}