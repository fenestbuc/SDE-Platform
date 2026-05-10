import * as webpush from "web-push";
import { config } from "../config";
import { db } from "../db";

if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY && config.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    config.VAPID_SUBJECT,
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY
  );
}

export class NotificationService {
  static async subscribe(userId: string, subscription: any) {
    const existing = await db.pushSubscription.findUnique({ where: { endpoint: subscription.endpoint } });
    if (!existing) {
      await db.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      });
    }
  }

  static async unsubscribe(endpoint: string) {
    await db.pushSubscription.deleteMany({ where: { endpoint } });
  }

  static async sendPushToUser(userId: string, payload: any) {
    if (!config.VAPID_PUBLIC_KEY) return;
    const subs = await db.pushSubscription.findMany({ where: { userId } });
    
    for (const sub of subs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      
      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      } catch (e: any) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          // Subscription has expired or is no longer valid
          await db.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          console.error("Error sending push notification", e);
        }
      }
    }
  }
}
