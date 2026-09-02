export type Edges = Map<string, string[]>;

export type PrereqNode = {
  courseId: string;
  prerequisites: PrereqNode[];
};

export const MAX_PREREQ_DEPTH = 6;

const cloneEdges = (edges: Edges): Edges => {
  const next: Edges = new Map();
  for (const [from, tos] of edges) {
    next.set(from, [...tos]);
  }
  return next;
};

export const withProposedEdge = (edges: Edges, courseId: string, prerequisiteId: string): Edges => {
  const next = cloneEdges(edges);
  const current = next.get(courseId) ?? [];
  next.set(courseId, [...current, prerequisiteId]);
  return next;
};

export function wouldCreateCycle(
  edges: Edges,
  courseId: string,
  prerequisiteId: string,
): string[] | null {
  if (courseId === prerequisiteId) {
    return [courseId, prerequisiteId];
  }

  const visit = (node: string, path: string[]): string[] | null => {
    if (path.includes(node)) {
      return null;
    }

    const nextPath = [...path, node];
    if (path.length > 0 && node === courseId) {
      return nextPath;
    }

    const children = edges.get(node) ?? [];
    for (const child of children) {
      const found = visit(child, nextPath);
      if (found !== null) {
        return found;
      }
    }

    return null;
  };

  const reached = visit(prerequisiteId, []);
  if (reached === null) {
    return null;
  }

  return [...reached, prerequisiteId];
}

export function collectTree(edges: Edges, courseId: string, maxDepth: number): PrereqNode[] {
  const walk = (id: string, depth: number, stack: readonly string[]): PrereqNode[] => {
    if (depth >= maxDepth) {
      return [];
    }

    const children = edges.get(id) ?? [];
    const nodes: PrereqNode[] = [];
    for (const childId of children) {
      const looping = stack.includes(childId);
      nodes.push({
        courseId: childId,
        prerequisites: looping ? [] : walk(childId, depth + 1, [...stack, id]),
      });
    }
    return nodes;
  };

  return walk(courseId, 0, []);
}

export function maxDepth(edges: Edges, courseId: string): number {
  const walk = (id: string, stack: readonly string[]): number => {
    if (stack.includes(id)) {
      return 0;
    }

    const children = edges.get(id) ?? [];
    if (children.length === 0) {
      return 0;
    }

    let longest = 0;
    for (const child of children) {
      const childDepth = 1 + walk(child, [...stack, id]);
      if (childDepth > longest) {
        longest = childDepth;
      }
    }
    return longest;
  };

  return walk(courseId, []);
}

export function exceedsMaxChainDepth(edges: Edges, limit: number = MAX_PREREQ_DEPTH): boolean {
  const nodes = new Set<string>();
  for (const [from, tos] of edges) {
    nodes.add(from);
    for (const to of tos) {
      nodes.add(to);
    }
  }

  for (const node of nodes) {
    if (maxDepth(edges, node) > limit) {
      return true;
    }
  }

  return false;
}
