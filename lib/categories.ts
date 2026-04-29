export type CategoryId =
  | "furniture"
  | "electronics"
  | "books"
  | "clothes"
  | "kitchen"
  | "kids"
  | "art"
  | "other";

export type Category = { id: CategoryId; label: string; emoji: string };

export const CATEGORIES: Category[] = [
  { id: "furniture",  label: "Furniture",  emoji: "🛋️" },
  { id: "electronics",label: "Electronics",emoji: "📺" },
  { id: "books",      label: "Books",      emoji: "📚" },
  { id: "clothes",    label: "Clothes",    emoji: "👕" },
  { id: "kitchen",    label: "Kitchen",    emoji: "🍳" },
  { id: "kids",       label: "Kids",       emoji: "🧸" },
  { id: "art",        label: "Art",        emoji: "🖼️" },
  { id: "other",      label: "Other",      emoji: "📦" },
];

export function categoryOf(id: string | null | undefined): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
