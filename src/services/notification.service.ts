import { fcm } from '../config/firebase';

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!fcm) { console.warn('Firebase not configured — skipping push notification'); return; }
  await fcm.send({ token, notification: { title, body }, data, android: { priority: 'high' } });
}

export async function sendMulticastNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!fcm || tokens.length === 0) return;
  await fcm.sendEachForMulticast({ tokens, notification: { title, body }, data, android: { priority: 'high' } });
}
