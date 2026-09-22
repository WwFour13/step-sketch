# LeetCode Test Problems — Required Test Suite

> **Note for Any LeetCode Testing / Verification**:
> Any test, automated check, or validation of the Step Sketch LeetCode loader **MUST** test against these problems. Each problem number was selected to test a distinct fundamental data structure and representation format on the canvas.

---

## Benchmark Problems by Data Type

| Problem # | Title | Target Data Type | Python Signature Inputs | Canvas / Sketch Representation |
| :--- | :--- | :--- | :--- | :--- |
| **`1`** | **Two Sum** | **1D Array + Scalar** | `nums: List[int], target: int` | Horizontal array cells (`nums`) + single variable square (`target`) |
| **`2`** | **Add Two Numbers** | **Singly Linked Lists (Multi)** | `l1: Optional[ListNode], l2: Optional[ListNode]` | Connected node boxes with pointer arrows (`→`) and head iterators |
| **`3`** | **Longest Substring Without Repeating Characters** | **String** | `s: str` | Horizontal character array cells (`s`) |
| **`14`** | **Longest Common Prefix** | **List of Strings** | `strs: List[str]` | Multiple string arrays stacked vertically (`strs[0]`, `strs[1]`, ...) |
| **`48`** | **Rotate Image** | **2D Array / Matrix** | `matrix: List[List[int]]` | 2D Matrix rows stacked as arrays (`matrix[0]`, `matrix[1]`, ...) |
| **`70`** | **Climbing Stairs** | **Scalar Integer** | `n: int` | Single variable square (`n`) |
| **`94`** | **Binary Tree Inorder Traversal** | **Binary Tree** | `root: Optional[TreeNode]` | Tree nodes with left/right pointers (or fallback representation) |
| **`133`** | **Clone Graph** | **Graph Node** | `node: Optional['Node']` | Graph nodes with adjacency pointers |
| **`206`** | **Reverse Linked List** | **Singly Linked List (Single)** | `head: Optional[ListNode]` | Connected node boxes with pointer arrows (`→`) and `head` iterator |

---

## Example Test Cases Summary

### 1. Problem #1 — Two Sum (1D Array + Scalar Int)
- **Input 1**: `nums = [2,7,11,15]`, `target = 9`
- **Input 2**: `nums = [3,2,4]`, `target = 6`
- **Input 3**: `nums = [3,3]`, `target = 6`

### 2. Problem #2 — Add Two Numbers (Linked Lists)
- **Input 1**: `l1 = [2,4,3]`, `l2 = [5,6,4]`
- **Input 2**: `l1 = [0]`, `l2 = [0]`
- **Input 3**: `l1 = [9,9,9,9,9,9,9]`, `l2 = [9,9,9,9]`

### 3. Problem #3 — Longest Substring (String)
- **Input 1**: `s = "abcabcbb"`
- **Input 2**: `s = "bbbbb"`
- **Input 3**: `s = "pwwkew"`

### 4. Problem #14 — Longest Common Prefix (Array of Strings)
- **Input 1**: `strs = ["flower","flow","flight"]`
- **Input 2**: `strs = ["dog","racecar","car"]`

### 5. Problem #48 — Rotate Image (2D Matrix)
- **Input 1**: `matrix = [[1,2,3],[4,5,6],[7,8,9]]`
- **Input 2**: `matrix = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]`

### 6. Problem #70 — Climbing Stairs (Scalar Integer)
- **Input 1**: `n = 2`
- **Input 2**: `n = 3`

### 7. Problem #94 — Binary Tree Inorder Traversal (Binary Tree)
- **Input 1**: `root = [1,null,2,3]`
- **Input 2**: `root = [1,2,3,4,5,null,8,null,null,6,7,9]`
- **Input 3**: `root = []`
- **Input 4**: `root = [1]`

### 8. Problem #133 — Clone Graph (Graph Node)
- **Input 1**: `adjList = [[2,4],[1,3],[2,4],[1,3]]`
- **Input 2**: `adjList = [[]]`
- **Input 3**: `adjList = []`

### 9. Problem #206 — Reverse Linked List (Single Linked List)
- **Input 1**: `head = [1,2,3,4,5]`
- **Input 2**: `head = [1,2]`
- **Input 3**: `head = []`

