import {FastifyInstance, FastifyPluginOptions} from 'fastify';
import PushController from './push.controller.js';

const subscribeSchema = {
    body: {
        type: 'object',
        required: ['endpoint', 'keys'],
        properties: {
            endpoint: { type: 'string' },
            expirationTime: { 
                type: ['string', 'null'],
                nullable: true 
            },
            keys: {
                type: 'object',
                required: ['p256dh', 'auth'],
                properties: {
                    p256dh: { type: 'string' },
                    auth: { type: 'string' }
                }
            }
        }
    },
    response: {
        201: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                subscriptionId: { type: 'string' }
            }
        },
        400: { $ref: 'error' },
        401: { $ref: 'error' },
        500: { $ref: 'error' }
    }
};

const unsubscribeSchema = {
    body: {
        type: 'object',
        required: ['endpoint'],
        properties: {
            endpoint: { type: 'string' }
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                success: { type: 'boolean' }
            }
        },
        400: { $ref: 'error' },
        401: { $ref: 'error' },
        404: { $ref: 'error' },
        500: { $ref: 'error' }
    }
};

const testNotificationSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                success: { type: 'boolean' }
            }
        },
        401: { $ref: 'error' },
        500: { $ref: 'error' }
    }
};

export default async function pushPlugin(fastify: FastifyInstance, _options: FastifyPluginOptions) {
    
    fastify.post('/api/push/subscribe', {
        schema: subscribeSchema,
        preHandler: fastify.authenticate
    }, PushController.subscribe);

    fastify.post('/api/push/unsubscribe', {
        schema: unsubscribeSchema,
        preHandler: fastify.authenticate
    }, PushController.unsubscribe);

    fastify.post('/api/push/test', {
        schema: testNotificationSchema,
        preHandler: fastify.authenticate
    }, PushController.testNotification);
}