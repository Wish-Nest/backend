import { JWT } from '@fastify/jwt'
import {JwtToken} from "../modules/common/web/jwt.js";

declare module 'fastify' {
    interface FastifyRequest {
        jwt: JWT
    }

    export interface FastifyInstance {
        authenticate: any
    }
}


declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: JwtToken
    }
}