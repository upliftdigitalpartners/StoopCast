import type { Stats } from "./types";

export type Achievement = {
  id: string;
  name: string;
  emoji: string;
  hint: string;
  earned: boolean;
};

export function computeAchievements(s: Stats | null): Achievement[] {
  const z = s ?? { posts: 0, claims: 0, karma: 0, home_set: false, weekly_karma: 0, streak_days: 0 };
  return [
    { id: "first_post",  emoji: "🪑", name: "First Post",        hint: "Post your first find",         earned: z.posts >= 1 },
    { id: "stooper_5",   emoji: "🛋️", name: "Stooper",            hint: "Post 5 finds",                 earned: z.posts >= 5 },
    { id: "stooper_25",  emoji: "🏛️", name: "Stoop King",         hint: "Post 25 finds",                earned: z.posts >= 25 },
    { id: "first_claim", emoji: "🙌", name: "Eagle Eye",          hint: "Claim your first stoop find",  earned: z.claims >= 1 },
    { id: "claims_10",   emoji: "🦅", name: "Pro Spotter",        hint: "Claim 10 finds",               earned: z.claims >= 10 },
    { id: "neighborhood",emoji: "🏠", name: "Local Legend",       hint: "Set your neighborhood",        earned: z.home_set },
    { id: "karma_10",    emoji: "⭐", name: "Karma Collector",    hint: "Earn 10 karma",                earned: z.karma >= 10 },
    { id: "streak_3",    emoji: "🔥", name: "On a Roll",          hint: "Post 3 days in a row",         earned: z.streak_days >= 3 },
    { id: "streak_7",    emoji: "💎", name: "Stoop Devotee",      hint: "Post 7 days in a row",         earned: z.streak_days >= 7 },
  ];
}
