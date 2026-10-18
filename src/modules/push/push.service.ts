import webpush from 'web-push';
import {ENV} from '../../config/env.js';
import orm from '../common/orm/orm.js';
import {PushSubscription} from './database/push-subscription.entity.js';
import {pushSubscriptionRepo, PushSubscriptionRepository} from './database/push-subscription.repository.js';
import {User} from "../user/database/user.entity.js";
import GroupService from "../family/group/group.service.js";
import {Gift} from "../family/gift/database/gift.entity.js";

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: {
        url?: string;
        [key: string]: any;
    };
}

export class PushNotificationService {
    private pushSubscriptionRepo: PushSubscriptionRepository;

    constructor() {
        this.pushSubscriptionRepo = pushSubscriptionRepo;
        
        // Configure web-push with VAPID keys
        webpush.setVapidDetails(
            ENV.VAPID_SUBJECT,
            ENV.VAPID_PUBLIC_KEY,
            ENV.VAPID_PRIVATE_KEY
        );
    }

    async createSubscription(userUuid: string, subscription: any): Promise<PushSubscription> {
        // Check if subscription already exists
        const existingSubscription = await this.pushSubscriptionRepo.findOne({ endpoint: subscription.endpoint });
        if (existingSubscription) {
            // Update existing subscription
            existingSubscription.p256dh = subscription.keys?.p256dh || null;
            existingSubscription.auth = subscription.keys?.auth || null;
            existingSubscription.lastUsed = new Date();
            await orm.em.persistAndFlush(existingSubscription);
            return existingSubscription;
        }

        // Create new subscription
        const pushSubscription = new PushSubscription();
        pushSubscription.user = (orm.em.getReference('User', userUuid) as User);
        pushSubscription.endpoint = subscription.endpoint;
        pushSubscription.p256dh = subscription.keys?.p256dh || null;
        pushSubscription.auth = subscription.keys?.auth || null;
        
        await orm.em.persistAndFlush(pushSubscription);
        return pushSubscription;
    }

    async sendNotificationToUser(userUuid: string, payload: NotificationPayload): Promise<void> {
        const subscriptions = await this.pushSubscriptionRepo.find({ user: { uuid: userUuid } });
        console.log("Send notification to user " + userUuid + " with " + subscriptions.length + " subscriptions");

        const promises = subscriptions.map(async (subscription) => {
            try {
                await webpush.sendNotification(
                    // @ts-ignore
                    subscription.toWebPushSubscription(),
                    JSON.stringify(payload)
                );
                
                // Update last used timestamp
                subscription.lastUsed = new Date();
                await orm.em.persistAndFlush(subscription);
                
            } catch (error: any) {
                console.error('Failed to send push notification:', error);
                
                // If subscription is invalid (410 Gone), remove it
                if (error.statusCode === 410) {
                    await orm.em.removeAndFlush(subscription);
                }
            }
        });

        await Promise.allSettled(promises);
    }

    async sendNotificationToUsers(userUuids: string[], payload: NotificationPayload): Promise<void> {
        const promises = userUuids.map(userUuid => this.sendNotificationToUser(userUuid, payload));
        await Promise.allSettled(promises);
    }

    async sendNotificationToGift(gift: Gift, title: string, body: string, url: string | null | undefined = null) : Promise<void> {
        try {
            const group = await GroupService.getGroupByTargetUuid(gift.userFamily.user.uuid, gift.userFamily.family.uuid);

            const targetUserFamily = group?.family.getMember(group?.target.uuid)
            if (!targetUserFamily) {
                throw new Error("Target user family not found");
            }

            await this.sendNotificationToUsers(group?.group_users.map(
                (member) => {
                    return member.user.uuid;
                }
            ) ?? [], {
                title,
                body,
                data: {
                    url: url ?? `/families/${group?.family.uuid}/member/${targetUserFamily.uuid}/gifts/${gift.uuid}`
                }
            });
        } catch (error) {
            console.error('Failed to send message notification:', error);
        }
    }

    async cleanupExpiredSubscriptions(): Promise<number> {
        // Remove subscriptions that haven't been used in 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return await this.pushSubscriptionRepo.nativeDelete({
            lastUsed: { $lt: thirtyDaysAgo }
        });
    }
}

export default new PushNotificationService();