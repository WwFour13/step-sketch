# LeetCode Test Problems - LLM Benchmark Set

These 19 problems are the selected benchmark set for LLM conversion into
Step Sketch's normalized test-case format. They cover primitive inputs,
collections, linked structures, trees, graphs, and operation sequences.

## Benchmarks by Data Type

| Problem # | Title | Input shape / representation to classify |
| :--- | :--- | :--- |
| **`1`** | **Two Sum** | `nums: List[int]` plus scalar `target` |
| **`2`** | **Add Two Numbers** | Two separate singly linked-list heads: `l1`, `l2` |
| **`3`** | **Longest Substring Without Repeating Characters** | String `s` |
| **`14`** | **Longest Common Prefix** | List of strings `strs` |
| **`23`** | **Merge k Sorted Lists** | A list of separate linked-list heads (`lists`), not one list whose node values are arrays |
| **`48`** | **Rotate Image** | 2D integer matrix `matrix` |
| **`70`** | **Climbing Stairs** | Scalar integer `n` |
| **`94`** | **Binary Tree Inorder Traversal** | Binary tree `root`, encoded in level-order with `null` placeholders |
| **`113`** | **Path Sum II** | Binary tree `root` plus scalar `targetSum` |
| **`133`** | **Clone Graph** | Graph node input encoded by adjacency lists |
| **`138`** | **Copy List with Random Pointer** | Linked list with `next` and `random` links; examples encode nodes as `[value, random_index]` pairs |
| **`146`** | **LRU Cache** | Operation sequence: string operations and corresponding argument arrays |
| **`200`** | **Number of Islands** | 2D character grid `grid` |
| **`206`** | **Reverse Linked List** | One singly linked-list head `head` |
| **`207`** | **Course Schedule** | Scalar `numCourses` plus prerequisite pairs |
| **`297`** | **Serialize and Deserialize Binary Tree** | Binary tree input `root` encoded in level-order with `null` placeholders |
| **`429`** | **N-ary Tree Level Order Traversal** | N-ary tree `root` encoded with level separators; do not interpret it as a binary tree |
| **`435`** | **Non-overlapping Intervals** | List of 2-value intervals |
| **`847`** | **Shortest Path Visiting All Nodes** | Graph encoded as adjacency lists |

## Representation Notes

- Preserve every example as a distinct test case and retain the input names
  shown in the problem description.
- Distinguish nested input structures by their meaning. In particular,
  #23's `lists` contains separate linked lists, #48/#200 are matrices, #207
  has a list of prerequisite pairs, and #435 has a list of intervals.
- For #138, preserve the pair structure and random-pointer indices; flattening
  these into an ordinary linked list loses essential structure.
- For #146, preserve the parallel operations and arguments as separate inputs.
- The current shape enum does not have a dedicated n-ary-tree shape. For #429,
  retain the level-order values and separators faithfully rather than labeling
  the input as a binary tree or inventing a new enum.
