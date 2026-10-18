import {FastifyRequest, FastifyReply} from 'fastify';
import PushNotificationService from './push.service.js';

interface SubscribeBody {
    endpoint: string;
    expirationTime?: string | null;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export class PushController {
    
    async subscribe(req: FastifyRequest<{ Body: SubscribeBody }>, reply: FastifyReply) {
        try {
            if (!req.user?.uuid) {
                return reply.status(401).send({ error: 'Authentication required' });
            }

            const subscription = req.body;
            
            if (!subscription || !subscription.endpoint) {
                return reply.status(400).send({ error: 'Invalid subscription data' });
            }

            const pushSubscription = await PushNotificationService.createSubscription(
                req.user.uuid,
                subscription
            );

            return reply.status(201).send({ 
                success: true,
                subscriptionId: pushSubscription.uuid
            });
            
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ error: 'Failed to create subscription' });
        }
    }

    async unsubscribe(req: FastifyRequest<{ Body: { endpoint: string } }>, reply: FastifyReply) {
        try {
            if (!req.user?.uuid) {
                return reply.status(401).send({ error: 'Authentication required' });
            }

            const { endpoint } = req.body;
            
            if (!endpoint) {
                return reply.status(400).send({ error: 'Endpoint is required' });
            }

            // Find and remove the subscription
            const pushSubscriptionRepo = PushNotificationService['pushSubscriptionRepo'];
            const subscription = await pushSubscriptionRepo.findOne({ endpoint });
            
            if (subscription && subscription.user.uuid === req.user.uuid) {
                await pushSubscriptionRepo.getEntityManager().removeAndFlush(subscription);
                return reply.status(200).send({ success: true });
            }

            return reply.status(404).send({ error: 'Subscription not found' });
            
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ error: 'Failed to remove subscription' });
        }
    }

    async testNotification(req: FastifyRequest, reply: FastifyReply) {
        try {
            if (!req.user?.uuid) {
                return reply.status(401).send({ error: 'Authentication required' });
            }

            await PushNotificationService.sendNotificationToUser(req.user.uuid, {
                title: 'Test Notification',
                body: 'This is a test notification from Wish Nest!',
                data: {
                    url: '/app'
                }
            });

            return reply.status(200).send({ success: true });
            
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ error: 'Failed to send test notification' });
        }
    }
}

export default new PushController();