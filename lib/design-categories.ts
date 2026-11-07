/**
 * Helpers for the "design type" categories of the 2D Graphic Design section.
 *
 * Categories are stored as plain strings in `tags`. Typing the same category twice with a different
 * case / spacing / accent ("Menu Design" vs "menu  design") used to create two separate categories.
 * Everything here compares categories by a normalized key so those variants are treated as one.
 */

export function categoryKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type CategoryOption = {
  key: string;
  /** The spelling shown to people: the most used one, or the first one seen when tied. */
  name: string;
  /** Number of projects that have this category. */
  count: number;
};

/** Unique categories across projects (each project counts once), most used first. */
export function collectCategories(tagLists: string[][]): CategoryOption[] {
  const groups = new Map<string, { spellings: Map<string, number>; count: number }>();
  for (const tags of tagLists) {
    const seenInProject = new Set<string>();
    for (const raw of tags) {
      const name = raw.trim().replace(/\s+/g, " ");
      const key = categoryKey(name);
      if (!key) continue;
      const group = groups.get(key) ?? { spellings: new Map<string, number>(), count: 0 };
      group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1);
      if (!seenInProject.has(key)) {
        seenInProject.add(key);
        group.count += 1;
      }
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      // Map keeps insertion order, so on a tie the spelling seen first wins.
      const name = [...group.spellings.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
      return { key, name, count: group.count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Replaces every tag by the existing spelling of the same category and removes duplicates. */
export function canonicalizeCategories(tags: string[], known: CategoryOption[]): string[] {
  const byKey = new Map(known.map((option) => [option.key, option.name]));
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = categoryKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(byKey.get(key) ?? name);
  }
  return result;
}
