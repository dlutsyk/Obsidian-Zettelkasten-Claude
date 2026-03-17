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

export function getParentId(id: string): string | null {
  const parts = id.match(/(\d+|[a-z]+)/g);
  if (!parts || parts.length <= 1) return null;
  return parts.slice(0, -1).join("");
}

export function isParentChild(a: string, b: string): boolean {
  return getParentId(b) === a || getParentId(a) === b;
}

export interface TreeNode {
  zk_id: string;
  title: string;
  status: string;
  path: string;
  children: TreeNode[];
}

export function buildTree(notes: { zk_id: string; title: string; status: string; path: string }[]): TreeNode[] {
  const sorted = [...notes].sort((a, b) => compareLuhmannIds(a.zk_id, b.zk_id));
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const n of sorted) {
    const node: TreeNode = { zk_id: n.zk_id, title: n.title, status: n.status, path: n.path, children: [] };
    nodeMap.set(n.zk_id, node);
    // Walk up parent chain to find nearest existing ancestor
    let ancestor: TreeNode | undefined;
    let cur: string | null = n.zk_id;
    while ((cur = getParentId(cur)) !== null) {
      ancestor = nodeMap.get(cur);
      if (ancestor) break;
    }
    if (ancestor) ancestor.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function renderTree(nodes: TreeNode[], depth = 5, prefix = "", currentDepth = 0): string {
  let out = "";
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const last = i === nodes.length - 1;
    const connector = currentDepth === 0 ? "" : (last ? "└─ " : "├─ ");
    const statusMark = node.status === "finalized" ? "✓" : "·";
    out += `${prefix}${connector}[${node.zk_id}] ${statusMark} ${node.title}\n`;
    if (currentDepth < depth - 1 && node.children.length > 0) {
      const childPrefix = currentDepth === 0 ? "" : prefix + (last ? "   " : "│  ");
      out += renderTree(node.children, depth, childPrefix, currentDepth + 1);
    }
  }
  return out;
}

export function getContext(
  notes: { zk_id: string; title: string; status: string; path: string }[],
  contextId: string
): { ancestors: typeof notes; siblings: typeof notes; children: typeof notes } {
  const ancestors: typeof notes = [];
  let cur = contextId;
  while (true) {
    const pid = getParentId(cur);
    if (!pid) break;
    const found = notes.find((n) => n.zk_id === pid);
    ancestors.unshift(found ?? { zk_id: pid, title: "(missing)", status: "", path: "" });
    cur = pid;
  }

  const parentId = getParentId(contextId);
  const siblings = notes
    .filter((n) => n.zk_id !== contextId && getParentId(n.zk_id) === parentId)
    .sort((a, b) => compareLuhmannIds(a.zk_id, b.zk_id));

  const children = notes
    .filter((n) => getParentId(n.zk_id) === contextId)
    .sort((a, b) => compareLuhmannIds(a.zk_id, b.zk_id));

  return { ancestors, siblings, children };
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
