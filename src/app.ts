import {fastify, FastifyReply, FastifyRequest} from 'fastify';
import user_plugin from "./modules/user/user.plugin.js";
import orm_plugin from "./modules/common/orm/orm.plugin.js";
import {MikroORM} from "@mikro-orm/sqlite";
import cors from '@fastify/cors'
import fjwt, {FastifyJWT} from '@fastify/jwt'
import family_plugin from "./modules/family/family.plugin.js";
import push_plugin from "./modules/push/push.plugin.js";
import {DerivedKey} from "./modules/common/crypto/derived-key.js";
import UserService from "./modules/user/user.service.js";
import upload_plugin from "./modules/common/upload/upload.plugin.js";
import version_plugin from "./modules/version/version.plugin.js";

export async function bootstrap({ port = 3001, orm }: { port?: number, orm?: MikroORM } = {}) {
    const app = fastify({
        logger: true
    });

    app.addSchema({
        $id: 'error',
        type: 'object',
        properties: {
            error: { type: 'string' },
        },
        required: ['error'],
    })

    app.register(fjwt, {
        secret: "secret",
    })
    app.register(orm_plugin, { orm });
    app.register(cors, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })

    // register upload plugin early so /api/upload and /uploads are available
    app.register(upload_plugin);

    app.register(user_plugin);
    app.register(family_plugin);
    app.register(push_plugin);
    app.register(version_plugin);


    app.addHook('preHandler', (req, _res, next) => {
        // here we are
        req.jwt = app.jwt
        return next()
    })

    app.decorate(
        'authenticate',
        async (req: FastifyRequest, reply: FastifyReply) => {
            const auth = req.headers["authorization"];
            if (!auth) {
                return reply.status(401).send({ error: 'Authentication required' })
            }
            if(typeof auth !== 'string') {
                return reply.status(401).send({ error: 'Authentication required' })
            }
            const token = auth.split(" ")[1]
            if (!token) {
                return reply.status(401).send({ error: 'Authentication required' })
            }

            try {
                const tokenJwt = req.jwt.verify<FastifyJWT['user']>(token)
                //@ts-ignore
                tokenJwt.derived_key = await DerivedKey.fromB64(tokenJwt.derived_key);
                req.user = tokenJwt;
                const user = await UserService.getUserByUUID(tokenJwt.uuid);
                if(!user?.verified) {
                    return reply.status(401).send({ error: 'User not verified' })
                }
            } catch (err) {
                req.log.error(err)
                return reply.status(401).send({ error: 'Authentication required' })
            }
        },
    )

    const url = await app.listen({ port, host: '0.0.0.0' });

    return { app, url };
}