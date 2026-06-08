// Assistant chat history, persisted locally (last 20 turns) in app_settings.
import { create } from 'zustand';
import { ChatTurn } from '@/lib/ai-types';
import { getSetting, setSetting } from '@/db/settings';
import { generateId } from '@/lib/id';

const KEY = 'ai.chatHistory';
const MAX_TURNS = 20;

function parse(raw: string | null): ChatTurn[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return v.filter((t): t is ChatTurn => !!t && typeof (t as ChatTurn).text === 'string');
  } catch {
    // ignore
  }
  return [];
}

interface ChatState {
  turns: ChatTurn[];
  loaded: boolean;
  refresh: () => Promise<void>;
  add: (role: ChatTurn['role'], text: string) => Promise<ChatTurn>;
  clear: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  turns: [],
  loaded: false,
  refresh: async () => {
    set({ turns: parse(await getSetting(KEY)), loaded: true });
  },
  add: async (role, text) => {
    const turn: ChatTurn = { id: generateId(), role, text };
    const turns = [...get().turns, turn].slice(-MAX_TURNS);
    set({ turns });
    await setSetting(KEY, JSON.stringify(turns));
    return turn;
  },
  clear: async () => {
    set({ turns: [] });
    await setSetting(KEY, JSON.stringify([]));
  },
}));
