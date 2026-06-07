// Permission state for reminders. Wraps the notification service so components
// never call it directly for permission reads/requests.
import { create } from 'zustand';
import { getPermissionState, requestPermissions, PermissionState } from '@/services/notifications';
import { getNotificationsAsked, setNotificationsAsked } from '@/lib/storage';

interface NotificationsState {
  permission: PermissionState;
  asked: boolean;
  refresh: () => Promise<void>;
  request: () => Promise<PermissionState>;
  declineForNow: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  permission: 'undetermined',
  asked: false,
  refresh: async () => {
    const [permission, asked] = await Promise.all([
      getPermissionState(),
      getNotificationsAsked(),
    ]);
    set({ permission, asked });
  },
  request: async () => {
    const permission = await requestPermissions();
    set({ permission, asked: true });
    return permission;
  },
  declineForNow: async () => {
    await setNotificationsAsked(true);
    set({ asked: true });
  },
}));
