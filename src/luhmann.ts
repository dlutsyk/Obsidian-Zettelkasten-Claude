/**
 * Luhmann ID generation and sorting.
 */

// Alternating branching: digits branch into letters, letters into digits.
// 1 → 1a → 1a1 → 1a1a — each level alternates to create a hierarchical address.
export function nextId(existingIds: Set<string>, parentId?: string): string {
  if (!parentId) {
    // Next top-level integer
    let maxN = 0;
    for (const id of existingIds) {
      const m = id.match(/^(\d+)/);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    return String(maxN + 1);
  }

  const last = parentId[parentId.length - 1];
  if (/\d/.test(last)) {
    // Append letter
    for (let i = 0; i < 26; i++) {
      const candidate = parentId + String.fromCharCode(97 + i);
      if (!existingIds.has(candidate)) return candidate;
    }
  } else {
    // Append number
    for (let n = 1; n < 1000; n++) {
      const candidate = parentId + String(n);
      if (!existingIds.has(candidate)) return candidate;
    }
  }
  throw new Error(`No available ID under ${parentId}`);
}

// Split ID into alternating segments for comparison: "12ab3" → [12, "ab", 3]
export function luhmannSortKey(id: string): (string | number)[] {
  const parts = id.match(/(\d+|[a-z]+)/g) ?? [];
  return parts.map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : p));
}

export function compareLuhmannIds(a: string, b: string): number {
  const ka = luhmannSortKey(a);
  const kb = luhmannSortKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const va = ka[i];
    const vb = kb[i];
    if (va === undefined) return -1;
    if (vb === undefined) return 1;
    if (typeof va === "number" && typeof vb === "number") {
      if (va !== vb) return va - vb;
    } else if (typeof va === "string" && typeof vb === "string") {
      if (va !== vb) return va < vb ? -1 : 1;
    } else {
      // Mixed types: numbers sort before strings (1a < 1a1a at same depth)
      return typeof va === "number" ? -1 : 1;
    }
  }
  return 0;
}
