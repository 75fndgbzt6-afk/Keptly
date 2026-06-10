/**
 * Known pay + cancel URLs for popular services, keyed by lowercase name fragment.
 * Resolution order: item.payUrl / item.cancelUrl → name match → category default → Google search.
 */
import { Item, Category } from '@/types';

interface ServiceLinks {
  pay?: string;
  cancel?: string;
}

// Keys are lowercase fragments; first match wins.
const SERVICE_MAP: [string, ServiceLinks][] = [
  // ── Streaming / OTT ──────────────────────────────────────────────────────
  ['netflix',       { pay: 'https://www.netflix.com/account',               cancel: 'https://www.netflix.com/cancelplan' }],
  ['prime video',   { pay: 'https://www.amazon.in/gp/subs/primeclub/account/homepage.html', cancel: 'https://www.amazon.in/gp/subs/primeclub/account/homepage.html' }],
  ['amazon prime',  { pay: 'https://www.amazon.in/gp/subs/primeclub/account/homepage.html', cancel: 'https://www.amazon.in/gp/subs/primeclub/account/homepage.html' }],
  ['hotstar',       { pay: 'https://www.hotstar.com/in/account/subscription', cancel: 'https://www.hotstar.com/in/account/subscription' }],
  ['disney+',       { pay: 'https://www.hotstar.com/in/account/subscription', cancel: 'https://www.hotstar.com/in/account/subscription' }],
  ['disney plus',   { pay: 'https://www.hotstar.com/in/account/subscription', cancel: 'https://www.hotstar.com/in/account/subscription' }],
  ['sonyliv',       { pay: 'https://www.sonyliv.com/settings/subscription',   cancel: 'https://www.sonyliv.com/settings/subscription' }],
  ['zee5',          { pay: 'https://www.zee5.com/account',                    cancel: 'https://www.zee5.com/account' }],
  ['jiocinema',     { pay: 'https://www.jiocinema.com/',                      cancel: 'https://www.jiocinema.com/' }],
  ['mxplayer',      { pay: 'https://www.mxplayer.in/',                        cancel: 'https://www.mxplayer.in/' }],
  ['voot',          { pay: 'https://www.voot.com/',                           cancel: 'https://www.voot.com/' }],
  ['aha',           { pay: 'https://www.aha.video/',                          cancel: 'https://www.aha.video/' }],
  ['youtube premium', { pay: 'https://www.youtube.com/paid_memberships',      cancel: 'https://www.youtube.com/paid_memberships' }],
  ['hulu',          { pay: 'https://secure.hulu.com/account',                 cancel: 'https://secure.hulu.com/account/cancel' }],
  ['hbo max',       { pay: 'https://www.max.com/account/payment',             cancel: 'https://www.max.com/account/cancel-subscription' }],
  [' max ',         { pay: 'https://www.max.com/account/payment',             cancel: 'https://www.max.com/account/cancel-subscription' }],
  ['peacock',       { pay: 'https://www.peacocktv.com/account/billing',       cancel: 'https://www.peacocktv.com/account/cancel' }],
  ['paramount',     { pay: 'https://www.paramountplus.com/account/billing/',  cancel: 'https://www.paramountplus.com/account/cancel/' }],
  ['apple tv',      { pay: 'itms-apps://apps.apple.com/account/subscriptions', cancel: 'itms-apps://apps.apple.com/account/subscriptions' }],
  ['crunchyroll',   { pay: 'https://www.crunchyroll.com/account/membership',  cancel: 'https://www.crunchyroll.com/account/membership' }],

  // ── Music ─────────────────────────────────────────────────────────────────
  ['spotify',       { pay: 'https://www.spotify.com/account/subscription/',   cancel: 'https://www.spotify.com/account/subscription/cancel' }],
  ['apple music',   { pay: 'itms-apps://apps.apple.com/account/subscriptions', cancel: 'itms-apps://apps.apple.com/account/subscriptions' }],
  ['youtube music', { pay: 'https://www.youtube.com/paid_memberships',         cancel: 'https://www.youtube.com/paid_memberships' }],
  ['amazon music',  { pay: 'https://music.amazon.in/settings',                 cancel: 'https://music.amazon.in/settings' }],
  ['tidal',         { pay: 'https://account.tidal.com/subscription',           cancel: 'https://account.tidal.com/subscription' }],
  ['deezer',        { pay: 'https://www.deezer.com/account/subscription',      cancel: 'https://www.deezer.com/account/subscription' }],
  ['gaana',         { pay: 'https://gaana.com/subscription',                   cancel: 'https://gaana.com/subscription' }],
  ['jiosaavn',      { pay: 'https://www.jiosaavn.com/',                        cancel: 'https://www.jiosaavn.com/' }],
  ['wynk',          { pay: 'https://wynk.in/music/subscription',               cancel: 'https://wynk.in/music/subscription' }],

  // ── AI tools ──────────────────────────────────────────────────────────────
  ['chatgpt',       { pay: 'https://chat.openai.com/my-account/billing',       cancel: 'https://chat.openai.com/my-account/billing' }],
  ['openai',        { pay: 'https://platform.openai.com/account/billing',      cancel: 'https://platform.openai.com/account/billing' }],
  ['claude',        { pay: 'https://claude.ai/settings/billing',               cancel: 'https://claude.ai/settings/billing' }],
  ['anthropic',     { pay: 'https://claude.ai/settings/billing',               cancel: 'https://claude.ai/settings/billing' }],
  ['midjourney',    { pay: 'https://www.midjourney.com/account/',              cancel: 'https://www.midjourney.com/account/' }],
  ['github copilot',{ pay: 'https://github.com/settings/billing',              cancel: 'https://github.com/settings/billing/cancel_plan' }],
  ['copilot',       { pay: 'https://github.com/settings/billing',              cancel: 'https://github.com/settings/billing/cancel_plan' }],
  ['gemini',        { pay: 'https://gemini.google.com/advanced',               cancel: 'https://gemini.google.com/advanced' }],
  ['perplexity',    { pay: 'https://www.perplexity.ai/settings/subscription',  cancel: 'https://www.perplexity.ai/settings/subscription' }],
  ['grammarly',     { pay: 'https://account.grammarly.com/subscription',       cancel: 'https://account.grammarly.com/subscription' }],
  ['jasper',        { pay: 'https://app.jasper.ai/settings/billing',           cancel: 'https://app.jasper.ai/settings/billing' }],

  // ── Cloud / Software ──────────────────────────────────────────────────────
  ['icloud',        { pay: 'itms-apps://apps.apple.com/account/subscriptions', cancel: 'itms-apps://apps.apple.com/account/subscriptions' }],
  ['google one',    { pay: 'https://one.google.com/storage',                   cancel: 'https://one.google.com/storage' }],
  ['dropbox',       { pay: 'https://www.dropbox.com/account/billing',          cancel: 'https://www.dropbox.com/account/plan' }],
  ['microsoft 365', { pay: 'https://account.microsoft.com/services',           cancel: 'https://account.microsoft.com/services' }],
  ['office 365',    { pay: 'https://account.microsoft.com/services',           cancel: 'https://account.microsoft.com/services' }],
  ['office',        { pay: 'https://account.microsoft.com/services',           cancel: 'https://account.microsoft.com/services' }],
  ['adobe',         { pay: 'https://account.adobe.com/plans',                  cancel: 'https://account.adobe.com/plans' }],
  ['notion',        { pay: 'https://www.notion.so/my-account',                 cancel: 'https://www.notion.so/my-account' }],
  ['slack',         { pay: 'https://slack.com/billing',                        cancel: 'https://slack.com/billing' }],
  ['zoom',          { pay: 'https://zoom.us/billing',                          cancel: 'https://zoom.us/billing' }],
  ['github',        { pay: 'https://github.com/settings/billing',              cancel: 'https://github.com/settings/billing' }],
  ['figma',         { pay: 'https://www.figma.com/billing',                    cancel: 'https://www.figma.com/billing' }],
  ['canva',         { pay: 'https://www.canva.com/settings/billing',           cancel: 'https://www.canva.com/settings/billing' }],
  ['1password',     { pay: 'https://my.1password.com/billing',                 cancel: 'https://my.1password.com/billing' }],
  ['lastpass',      { pay: 'https://lastpass.com/account',                     cancel: 'https://lastpass.com/account' }],
  ['nordvpn',       { pay: 'https://my.nordaccount.com/dashboard/nordvpn/',    cancel: 'https://my.nordaccount.com/dashboard/nordvpn/' }],
  ['expressvpn',    { pay: 'https://www.expressvpn.com/subscriptions',         cancel: 'https://www.expressvpn.com/subscriptions' }],
  ['surfshark',     { pay: 'https://my.surfshark.com/dashboard',               cancel: 'https://my.surfshark.com/dashboard' }],
  ['linear',        { pay: 'https://linear.app/settings/billing',              cancel: 'https://linear.app/settings/billing' }],
  ['loom',          { pay: 'https://www.loom.com/settings/billing',            cancel: 'https://www.loom.com/settings/billing' }],

  // ── Gym / Fitness ─────────────────────────────────────────────────────────
  ['cult.fit',      { pay: 'https://www.cult.fit/',                            cancel: 'https://www.cult.fit/' }],
  ['cultfit',       { pay: 'https://www.cult.fit/',                            cancel: 'https://www.cult.fit/' }],
  ['strava',        { pay: 'https://www.strava.com/account',                   cancel: 'https://www.strava.com/account' }],
  ['peloton',       { pay: 'https://members.onepeloton.com/profile/billing',   cancel: 'https://members.onepeloton.com/profile/billing' }],
  ['fitbit',        { pay: 'itms-apps://apps.apple.com/account/subscriptions', cancel: 'itms-apps://apps.apple.com/account/subscriptions' }],
  ['nike',          { pay: 'itms-apps://apps.apple.com/account/subscriptions', cancel: 'itms-apps://apps.apple.com/account/subscriptions' }],
  ['apple fitness', { pay: 'itms-apps://apps.apple.com/account/subscriptions', cancel: 'itms-apps://apps.apple.com/account/subscriptions' }],

  // ── Telecom ───────────────────────────────────────────────────────────────
  ['jio',           { pay: 'https://www.jio.com/selfcare/',                    cancel: 'https://www.jio.com/selfcare/' }],
  ['airtel',        { pay: 'https://www.airtel.in/myairtel/',                  cancel: 'https://www.airtel.in/myairtel/' }],
  ['vi ',           { pay: 'https://www.myvi.in/',                             cancel: 'https://www.myvi.in/' }],
  ['vodafone',      { pay: 'https://www.myvi.in/',                             cancel: 'https://www.myvi.in/' }],
  ['bsnl',          { pay: 'https://selfcare.bsnl.co.in/',                     cancel: 'https://selfcare.bsnl.co.in/' }],
  ['at&t',          { pay: 'https://www.att.com/buy/broadband/plans.html',     cancel: 'https://www.att.com/support/' }],
  ['verizon',       { pay: 'https://www.verizon.com/home/myverizon/',          cancel: 'https://www.verizon.com/home/myverizon/' }],
  ['t-mobile',      { pay: 'https://account.t-mobile.com/',                    cancel: 'https://account.t-mobile.com/' }],

  // ── Insurance ─────────────────────────────────────────────────────────────
  ['lic',           { pay: 'https://licindia.in/Online-Services',              cancel: 'https://licindia.in/Online-Services' }],
  ['hdfc ergo',     { pay: 'https://www.hdfcergo.com/',                        cancel: 'https://www.hdfcergo.com/' }],
  ['icici lombard', { pay: 'https://www.icicilombard.com/',                    cancel: 'https://www.icicilombard.com/' }],
  ['bajaj allianz', { pay: 'https://www.bajajallianz.com/',                    cancel: 'https://www.bajajallianz.com/' }],
  ['star health',   { pay: 'https://www.starhealth.in/',                       cancel: 'https://www.starhealth.in/' }],
  ['niva bupa',     { pay: 'https://www.nivabupa.com/',                        cancel: 'https://www.nivabupa.com/' }],
  ['care health',   { pay: 'https://www.careinsurance.com/',                   cancel: 'https://www.careinsurance.com/' }],

  // ── Membership ────────────────────────────────────────────────────────────
  ['amazon',        { pay: 'https://www.amazon.in/gp/subs/primeclub/account/homepage.html', cancel: 'https://www.amazon.in/gp/subs/primeclub/account/homepage.html' }],
  ['costco',        { pay: 'https://www.costco.com/MembershipMembership.html', cancel: 'https://customerservice.costco.com/' }],
  ['sam\'s club',   { pay: 'https://www.samsclub.com/account',                 cancel: 'https://www.samsclub.com/account' }],
];

/** Category-level pay fallback when no service name match is found. */
const CATEGORY_PAY_FALLBACK: Partial<Record<Category, string>> = {
  'Streaming/OTT':   'itms-apps://apps.apple.com/account/subscriptions',
  'Music':           'itms-apps://apps.apple.com/account/subscriptions',
  'AI tools':        'itms-apps://apps.apple.com/account/subscriptions',
  'Cloud/Software':  'itms-apps://apps.apple.com/account/subscriptions',
  'Gym/Fitness':     'itms-apps://apps.apple.com/account/subscriptions',
  'Membership':      'itms-apps://apps.apple.com/account/subscriptions',
};

function matchService(name: string): ServiceLinks | null {
  const lower = name.toLowerCase();
  for (const [key, links] of SERVICE_MAP) {
    if (lower.includes(key)) return links;
  }
  return null;
}

/** Returns the best pay URL for an item — never null. */
export function resolvePayUrl(item: Item): string {
  if (item.payUrl) return item.payUrl;
  const match = matchService(item.name);
  if (match?.pay) return match.pay;
  const categoryFallback = CATEGORY_PAY_FALLBACK[item.category as Category];
  if (categoryFallback) return categoryFallback;
  // Last resort: Google search so there's always something useful.
  return `https://www.google.com/search?q=${encodeURIComponent(item.name + ' pay bill online')}`;
}

/** Returns the best cancel URL for an item — never null. */
export function resolveCancelUrl(item: Item): string {
  if (item.cancelUrl) return item.cancelUrl;
  const match = matchService(item.name);
  if (match?.cancel) return match.cancel;
  // iOS subscription manager handles App Store subscriptions directly.
  return 'itms-apps://apps.apple.com/account/subscriptions';
}
