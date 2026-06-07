// Notification service — the ONLY place expo-notifications is touched.
// Components must call these functions; never import expo-notifications directly.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Item } from '@/types';
import { computeTriggers, isRecurring } from '@/lib/reminders';
import {
  notificationContent,
  NOTIFICATION_CATEGORY_ID,
  ACTION_IDS,
  ACTION_LABELS,
} from '@/lib/notification-copy';
import { addDays, addPeriod, fromISODate, toISODate } from '@/lib/date';
import { setNotificationsAsked } from '@/lib/storage';
import {
  createReminder,
  listReminders,
  listRemindersByItem,
  deleteRemindersByItem,
  markItemRemindersDismissed,
  updateReminderSchedule,
  updateReminderStatus,
  getReminder,
} from '@/db/reminders';
import { getItem, listItems, updateItemNextDate } from '@/db/items';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** iOS caps pending local notifications at 64; stay safely under it. */
const MAX_SCHEDULED = 60;
/** Only schedule triggers that fire within this many days; re-extend on launch. */
const WINDOW_DAYS = 60;

let handlerConfigured = false;

/** Foreground handler + categories + Android channel. Call once on startup. */
export async function initNotifications(): Promise<void> {
  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#4F46E5',
    });
  }

  await defineCategories();
}

/** Notification action category: Mark done · Snooze 1 day · Open. */
export async function defineCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
    { identifier: ACTION_IDS.done, buttonTitle: ACTION_LABELS.done, options: { opensAppToForeground: false } },
    { identifier: ACTION_IDS.snooze, buttonTitle: ACTION_LABELS.snooze, options: { opensAppToForeground: false } },
    { identifier: ACTION_IDS.open, buttonTitle: ACTION_LABELS.open, options: { opensAppToForeground: true } },
  ]);
}

function toState(status: Notifications.PermissionStatus): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return toState(status);
}

/** Request OS permission; remembers that we've asked so the pre-prompt isn't reshown. */
export async function requestPermissions(): Promise<PermissionState> {
  const { status } = await Notifications.requestPermissionsAsync();
  await setNotificationsAsked(true);
  const state = toState(status);
  if (state === 'granted') {
    await reconcile();
  }
  return state;
}

async function cancelOsNotifications(notificationIds: (string | null)[]): Promise<void> {
  for (const id of notificationIds) {
    if (id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // already gone; ignore
      }
    }
  }
}

function withinWindow(fireAt: Date, from: Date): boolean {
  const horizon = addDays(from, WINDOW_DAYS).getTime();
  return fireAt.getTime() <= horizon;
}

function isSchedulable(item: Item): boolean {
  return item.status === 'active' || item.status === 'paused';
}

/**
 * Schedule (and persist) the full reminder ladder for one item.
 * Clears any prior reminders for the item first, then recreates within the window.
 */
export async function scheduleForItem(item: Item): Promise<void> {
  const existing = await listRemindersByItem(item.id);
  await cancelOsNotifications(existing.map((r) => r.notificationId));
  await deleteRemindersByItem(item.id);

  if (!isSchedulable(item)) return;

  const now = new Date();
  const granted = (await getPermissionState()) === 'granted';
  const triggers = computeTriggers(item, now)
    .filter((t) => withinWindow(t.fireAt, now))
    .slice(0, MAX_SCHEDULED);

  for (const t of triggers) {
    const reminder = await createReminder({
      itemId: item.id,
      triggerDate: t.fireAt.toISOString(),
      leadTimeDays: t.leadTimeDays,
      type: t.type,
      status: 'pending',
      notificationId: null,
    });

    if (granted) {
      const { title, body } = notificationContent(item, t.type, t.leadTimeDays);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { itemId: item.id, reminderId: reminder.id },
          categoryIdentifier: NOTIFICATION_CATEGORY_ID,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.fireAt },
      });
      await updateReminderSchedule(reminder.id, reminder.triggerDate, notificationId, 'pending');
    }
  }
}

/** Cancel all of an item's scheduled notifications and mark its reminders dismissed. */
export async function cancelForItem(itemId: string): Promise<void> {
  const existing = await listRemindersByItem(itemId);
  await cancelOsNotifications(existing.map((r) => r.notificationId));
  await markItemRemindersDismissed(itemId);
}

/**
 * On launch: wipe all OS-scheduled notifications, then re-schedule the next
 * WINDOW_DAYS for every active item, honoring the iOS 64-notification cap by
 * prioritizing the soonest triggers across all items.
 */
export async function reconcile(): Promise<void> {
  const granted = (await getPermissionState()) === 'granted';

  // Clear every OS-scheduled notification (orphans included).
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await cancelOsNotifications(scheduled.map((s) => s.identifier));

  const items = (await listItems()).filter(isSchedulable);
  // Reset reminder rows for these items before recreating.
  for (const item of items) {
    await deleteRemindersByItem(item.id);
  }

  const now = new Date();
  const all = items
    .flatMap((item) =>
      computeTriggers(item, now)
        .filter((t) => withinWindow(t.fireAt, now))
        .map((t) => ({ item, trigger: t })),
    )
    .sort((a, b) => a.trigger.fireAt.getTime() - b.trigger.fireAt.getTime());

  let osCount = 0;
  for (const { item, trigger } of all) {
    const reminder = await createReminder({
      itemId: item.id,
      triggerDate: trigger.fireAt.toISOString(),
      leadTimeDays: trigger.leadTimeDays,
      type: trigger.type,
      status: 'pending',
      notificationId: null,
    });

    if (granted && osCount < MAX_SCHEDULED) {
      const { title, body } = notificationContent(item, trigger.type, trigger.leadTimeDays);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { itemId: item.id, reminderId: reminder.id },
          categoryIdentifier: NOTIFICATION_CATEGORY_ID,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger.fireAt },
      });
      await updateReminderSchedule(reminder.id, reminder.triggerDate, notificationId, 'pending');
      osCount += 1;
    }
  }
}

async function dismissReminder(reminderId: string): Promise<void> {
  const reminder = await getReminder(reminderId);
  if (reminder?.notificationId) {
    await cancelOsNotifications([reminder.notificationId]);
  }
  await updateReminderStatus(reminderId, 'dismissed');
}

/** Handle a notification action button (or a tap routed as 'open'). */
export async function handleAction(
  actionId: string,
  itemId: string,
  reminderId: string,
): Promise<void> {
  switch (actionId) {
    case ACTION_IDS.done: {
      const item = await getItem(itemId);
      await dismissReminder(reminderId);
      if (item && item.nextDate && isRecurring(item.billingCycle)) {
        const advanced = toISODate(addPeriod(fromISODate(item.nextDate), item.billingCycle));
        await updateItemNextDate(item.id, advanced);
      }
      return;
    }
    case ACTION_IDS.snooze: {
      const reminder = await getReminder(reminderId);
      const item = await getItem(itemId);
      if (!reminder || !item) return;
      if (reminder.notificationId) {
        await cancelOsNotifications([reminder.notificationId]);
      }
      const fireAt = addDays(new Date(), 1);
      let notificationId: string | null = null;
      if ((await getPermissionState()) === 'granted') {
        const { title, body } = notificationContent(item, reminder.type, reminder.leadTimeDays);
        notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { itemId, reminderId },
            categoryIdentifier: NOTIFICATION_CATEGORY_ID,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        });
      }
      await updateReminderSchedule(reminderId, fireAt.toISOString(), notificationId, 'pending');
      return;
    }
    case ACTION_IDS.open:
    default:
      router.push(`/item/${itemId}`);
      return;
  }
}

/** DEV helper: fire a sample notification ~10s from now to verify delivery + actions. */
export async function scheduleTestNotification(item: Item): Promise<void> {
  const { title, body } = notificationContent(item, 'renewal', 7);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { itemId: item.id, reminderId: 'test' },
      categoryIdentifier: NOTIFICATION_CATEGORY_ID,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10 },
  });
}

/** Subscribe to action responses; returns an unsubscribe function. */
export function addResponseListener(): { remove: () => void } {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      itemId?: string;
      reminderId?: string;
    };
    if (!data.itemId || !data.reminderId) return;
    void handleAction(response.actionIdentifier, data.itemId, data.reminderId);
  });
}

/** Re-export so a Notifications Center can list everything if needed. */
export { listReminders };
