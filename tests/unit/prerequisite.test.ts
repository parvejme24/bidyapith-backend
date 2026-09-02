import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectTree,
  type Edges,
  maxDepth,
  wouldCreateCycle,
} from '../../src/utils/prerequisiteGraph';

const edges = (pairs: Array<[string, string]>): Edges => {
  const map: Edges = new Map();
  for (const [from, to] of pairs) {
    const current = map.get(from) ?? [];
    current.push(to);
    map.set(from, current);
  }
  return map;
};

describe('wouldCreateCycle', () => {
  it('returns null when the new edge is acyclic', () => {
    const graph = edges([['CSE-2201', 'CSE-1101']]);
    assert.equal(wouldCreateCycle(graph, 'CSE-3101', 'CSE-2201'), null);
  });

  it('returns null when adding the first prerequisite of an empty graph', () => {
    assert.equal(wouldCreateCycle(new Map(), 'CSE-2201', 'CSE-1101'), null);
  });

  it('detects a direct two-node cycle', () => {
    const graph = edges([['CSE-2201', 'CSE-1101']]);
    const path = wouldCreateCycle(graph, 'CSE-1101', 'CSE-2201');
    assert.deepEqual(path, ['CSE-2201', 'CSE-1101', 'CSE-2201']);
  });

  it('detects an indirect three-node cycle', () => {
    const graph = edges([
      ['A', 'B'],
      ['B', 'C'],
    ]);
    const path = wouldCreateCycle(graph, 'C', 'A');
    assert.deepEqual(path, ['A', 'B', 'C', 'A']);
  });

  it('detects self-reference', () => {
    const path = wouldCreateCycle(new Map(), 'CSE-1101', 'CSE-1101');
    assert.deepEqual(path, ['CSE-1101', 'CSE-1101']);
  });
});

describe('collectTree and maxDepth', () => {
  it('builds a nested tree and measures chain length', () => {
    const graph = edges([
      ['A', 'B'],
      ['B', 'C'],
    ]);
    assert.deepEqual(collectTree(graph, 'A', 6), [
      {
        courseId: 'B',
        prerequisites: [{ courseId: 'C', prerequisites: [] }],
      },
    ]);
    assert.equal(maxDepth(graph, 'A'), 2);
    assert.equal(maxDepth(graph, 'C'), 0);
  });
});
