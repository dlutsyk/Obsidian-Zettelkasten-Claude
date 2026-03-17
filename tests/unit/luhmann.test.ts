import { describe, it, expect } from "vitest";
import {
  nextId,
  luhmannSortKey,
  compareLuhmannIds,
  getParentId,
  isParentChild,
  buildTree,
  renderTree,
  getContext,
} from "../../src/luhmann.js";

describe("nextId", () => {
  it("returns '1' for empty set with no parent", () => {
    expect(nextId(new Set())).toBe("1");
  });

  it("returns next integer for existing top-level IDs", () => {
    expect(nextId(new Set(["1", "2", "3"]))).toBe("4");
  });

  it("appends letter when parent ends with digit", () => {
    expect(nextId(new Set(), "1")).toBe("1a");
  });

  it("skips existing letter children", () => {
    expect(nextId(new Set(["1a"]), "1")).toBe("1b");
  });

  it("appends number when parent ends with letter", () => {
    expect(nextId(new Set(), "1a")).toBe("1a1");
  });

  it("skips existing number children", () => {
    expect(nextId(new Set(["1a1"]), "1a")).toBe("1a2");
  });

  it("handles multi-level branching", () => {
    expect(nextId(new Set(), "1a1")).toBe("1a1a");
  });

  it("finds max across non-sequential top-level IDs", () => {
    expect(nextId(new Set(["1", "5", "3"]))).toBe("6");
  });
});

describe("luhmannSortKey", () => {
  it("parses single number", () => {
    expect(luhmannSortKey("1")).toEqual([1]);
  });

  it("parses alternating segments", () => {
    expect(luhmannSortKey("12ab3")).toEqual([12, "ab", 3]);
  });

  it("returns empty for empty string", () => {
    expect(luhmannSortKey("")).toEqual([]);
  });

  it("parses complex ID", () => {
    expect(luhmannSortKey("1a1b2")).toEqual([1, "a", 1, "b", 2]);
  });
});

describe("compareLuhmannIds", () => {
  it("sorts numbers ascending", () => {
    expect(compareLuhmannIds("1", "2")).toBeLessThan(0);
    expect(compareLuhmannIds("2", "1")).toBeGreaterThan(0);
  });

  it("sorts letters ascending", () => {
    expect(compareLuhmannIds("1a", "1b")).toBeLessThan(0);
  });

  it("shorter prefix comes first", () => {
    expect(compareLuhmannIds("1", "1a")).toBeLessThan(0);
  });

  it("equal IDs return 0", () => {
    expect(compareLuhmannIds("1a1", "1a1")).toBe(0);
  });

  it("sorts multi-segment IDs correctly", () => {
    expect(compareLuhmannIds("1a1", "1a2")).toBeLessThan(0);
    expect(compareLuhmannIds("1b", "1a1")).toBeGreaterThan(0);
  });

  it("handles multi-digit numbers", () => {
    expect(compareLuhmannIds("10", "2")).toBeGreaterThan(0);
  });
});

describe("getParentId", () => {
  it("returns null for top-level", () => {
    expect(getParentId("1")).toBeNull();
    expect(getParentId("10")).toBeNull();
  });

  it("returns parent for single-letter child", () => {
    expect(getParentId("1a")).toBe("1");
  });

  it("returns parent for number child", () => {
    expect(getParentId("1a1")).toBe("1a");
  });

  it("returns parent for deep ID", () => {
    expect(getParentId("1a1b2")).toBe("1a1b");
  });
});

describe("isParentChild", () => {
  it("detects direct parent-child", () => {
    expect(isParentChild("1", "1a")).toBe(true);
    expect(isParentChild("1a", "1")).toBe(true);
  });

  it("rejects grandparent", () => {
    expect(isParentChild("1", "1a1")).toBe(false);
  });

  it("rejects siblings", () => {
    expect(isParentChild("1a", "1b")).toBe(false);
  });

  it("rejects unrelated", () => {
    expect(isParentChild("1", "2")).toBe(false);
  });
});

describe("buildTree", () => {
  const notes = (ids: string[]) =>
    ids.map((id) => ({ zk_id: id, title: `Note ${id}`, status: "draft", path: `${id}.md` }));

  it("builds single root", () => {
    const tree = buildTree(notes(["1"]));
    expect(tree).toHaveLength(1);
    expect(tree[0].zk_id).toBe("1");
    expect(tree[0].children).toHaveLength(0);
  });

  it("nests children under parent", () => {
    const tree = buildTree(notes(["1", "1a", "1b"]));
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].zk_id).toBe("1a");
    expect(tree[0].children[1].zk_id).toBe("1b");
  });

  it("builds multiple roots", () => {
    const tree = buildTree(notes(["1", "2"]));
    expect(tree).toHaveLength(2);
  });

  it("handles missing parent — attaches to nearest ancestor", () => {
    const tree = buildTree(notes(["1", "1a1"]));
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].zk_id).toBe("1a1");
  });

  it("handles deep nesting", () => {
    const tree = buildTree(notes(["1", "1a", "1a1", "1a1a"]));
    expect(tree[0].children[0].children[0].children[0].zk_id).toBe("1a1a");
  });

  it("sorts children by Luhmann order", () => {
    const tree = buildTree(notes(["1", "1b", "1a"]));
    expect(tree[0].children[0].zk_id).toBe("1a");
    expect(tree[0].children[1].zk_id).toBe("1b");
  });
});

describe("renderTree", () => {
  const notes = (ids: string[]) =>
    ids.map((id) => ({ zk_id: id, title: `N${id}`, status: "draft", path: `${id}.md` }));

  it("renders single root", () => {
    const tree = buildTree(notes(["1"]));
    expect(renderTree(tree)).toContain("[1] · N1");
  });

  it("renders finalized with checkmark", () => {
    const tree = buildTree([{ zk_id: "1", title: "Done", status: "finalized", path: "1.md" }]);
    expect(renderTree(tree)).toContain("✓ Done");
  });

  it("uses tree connectors for children", () => {
    const tree = buildTree(notes(["1", "1a", "1b"]));
    const out = renderTree(tree);
    expect(out).toContain("├─");
    expect(out).toContain("└─");
  });

  it("respects depth limit", () => {
    const tree = buildTree(notes(["1", "1a", "1a1"]));
    const out = renderTree(tree, 2);
    expect(out).toContain("[1a]");
    expect(out).not.toContain("[1a1]");
  });
});

describe("getContext", () => {
  const notes = [
    { zk_id: "1", title: "Root", status: "draft", path: "1.md" },
    { zk_id: "1a", title: "A", status: "draft", path: "1a.md" },
    { zk_id: "1b", title: "B", status: "draft", path: "1b.md" },
    { zk_id: "1a1", title: "A1", status: "draft", path: "1a1.md" },
    { zk_id: "2", title: "Other", status: "draft", path: "2.md" },
  ];

  it("finds ancestors", () => {
    const ctx = getContext(notes, "1a1");
    expect(ctx.ancestors.map((a) => a.zk_id)).toEqual(["1", "1a"]);
  });

  it("finds siblings", () => {
    const ctx = getContext(notes, "1a");
    expect(ctx.siblings.map((s) => s.zk_id)).toEqual(["1b"]);
  });

  it("finds children", () => {
    const ctx = getContext(notes, "1a");
    expect(ctx.children.map((c) => c.zk_id)).toEqual(["1a1"]);
  });

  it("top-level siblings", () => {
    const ctx = getContext(notes, "1");
    expect(ctx.siblings.map((s) => s.zk_id)).toEqual(["2"]);
  });

  it("shows missing ancestor placeholder", () => {
    const sparse = [
      { zk_id: "1", title: "Root", status: "draft", path: "1.md" },
      { zk_id: "1a1", title: "Deep", status: "draft", path: "1a1.md" },
    ];
    const ctx = getContext(sparse, "1a1");
    expect(ctx.ancestors[0].zk_id).toBe("1");
    expect(ctx.ancestors[1].zk_id).toBe("1a");
    expect(ctx.ancestors[1].title).toBe("(missing)");
  });
});
