# LeetCode Canvas Visualizer

An interactive, Excalidraw-style canvas application for sketching, visualizing, and human-like stepping through of LeetCode data structures and algorithm states.

## Key Features

- **Interactive Canvas:** Draw, connect, and reposition data structures like Linked Lists, Arrays, and Binary Trees.
- **LeetCode Integration:** Map LeetCode problem numbers directly to title slugs and fetch problem metadata, example inputs, and starter code snippets.
- **Algorithm State Tracking:** Manage pointers (`curr`, `prev`, `slow`, `fast`, `left`, `right`) and variable values visually on top of canvas nodes.

## Tech Stack

- **Framework:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/) (with `@vitejs/plugin-react` powered by [Oxc](https://oxc.rs/))
- **Linter:** [Oxlint](https://oxc.rs/docs/guide/usage/linter.html)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `pnpm`

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/WwFour13/step-sketch](https://github.com/WwFour13/step-sketch.git)
   cd your-repo-name