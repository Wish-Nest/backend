import UserService from "./user.service.js";
import {FastifyReply, FastifyRequest} from "fastify";
import {encodeJwt} from "../common/web/jwt.js";

export async function add_user(req: FastifyRequest<{
    Body: {
        email: string,
        password: string
    }
}>, reply: FastifyReply) {
    const {email, password} = req.body;

    if(!email || !password){
        reply.status(400);

        return {
            error: "Bad parameter"
        };
    }else{
        const oldUser = await UserService.getUserByEmail(email);
        if(oldUser){
            reply.status(400);
            return {
                error: "User already exists"
            };
        }
        const user = await UserService.createUser(email, password);

        if(!user){
            reply.status(500);
            return {
                error: "Internal server error"
            };
        }

        return {
            uuid: user.uuid,
            email: user.email
        };
    }
}

export async function login(req: FastifyRequest<{
    Body: {
        email: string,
        password: string
    }
}>, reply: FastifyReply) {
    const {email, password} = req.body;

    if(!email || !password){
        reply.status(400);
        return {
            error: "Bad parameter"
        }
    }

    try {
        const user = await UserService.getUserByEmail(email);
        if(user === null){
            reply.status(401);
            return {
                error: "Login failed"
            }
        }

        if(!await user.isPasswordValid(password)){
            reply.status(401);
            return {
                error: "Login failed"
            }
        }else{
             return {
                uuid: user.uuid,
                email: user.email,
                verified: user.verified,
                jwt: await encodeJwt({
                    uuid: user.uuid,
                    email: user.email,
                    verified: user.verified,
                    derived_key: await user.getDerivedKey(password)
                })
            };
        }
    } catch {
        reply.status(401);
        return {
            error: "Login failed, an error occurred"
        }
    }
}

export async function verify(req: FastifyRequest<{
    Body: {
        uuid: string,
        code: string
    }
}>, reply: FastifyReply) {
    const {code, uuid} = req.body;

    if(!code || !uuid){
        reply.status(400);
        return {error: "Bad parameter"};
    }

    const user = await UserService.getUserByUUID(uuid);
    if(user === null){
        reply.status(404);
        return {error: "User not found"};
    }

    if(user.verification_code !== code){
        reply.status(400);
        return {error: "Invalid code"};
    }

    const result = await UserService.verifyUser(uuid, code);

    if(result === null){
        reply.status(400);
        return {error: "Internal server error"};
    }

    return {
        uuid: user.uuid,
        email: user.email
    };
}
