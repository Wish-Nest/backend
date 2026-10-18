import {FastifyInstance} from "fastify";
import {S} from "fluent-json-schema";
import {APP_VERSION} from "../../config/version.js";

export default async function version_plugin(app: FastifyInstance) {
    app.get('/api/version', {
        schema: {
            response: {
                200: S.object()
                    .prop('version', S.string().required())
            }
        }
    }, async () => ({version: APP_VERSION}));
}
