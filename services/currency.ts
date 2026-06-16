// Changing the app's single global currency. Converts every stored monetary
// value (item amounts, insurance premiums, the monthly budget) from the old
// currency to the new one, then updates the preference. After this, all
// amounts in the DB are in the new currency, so every screen displays converted
// values with no per-render conversion needed.
import { convertAmount } from '@/lib/exchange';
import { convertItemsCurrency } from '@/db/items';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useItemsStore } from '@/stores/itemsStore';

export async function changeCurrency(to: string): Promise<void> {
  const prefs = usePreferencesStore.getState();
  const from = prefs.defaultCurrency;
  if (from === to) return;

  // 1. Convert every item's amount + premium and stamp the new currency.
  await convertItemsCurrency(from, to);

  // 2. Convert the monthly budget (it has no stored currency of its own).
  const monthlyBudget =
    prefs.monthlyBudget > 0 ? convertAmount(prefs.monthlyBudget, from, to) : prefs.monthlyBudget;

  // 3. Persist the new currency + budget (this also calls setActiveCurrency).
  await prefs.update({ defaultCurrency: to, monthlyBudget });

  // 4. Reload items so converted amounts show immediately.
  await useItemsStore.getState().refresh();
}
