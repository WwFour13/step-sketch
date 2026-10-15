# LeetCode Canvas Visualizer

An interactive, Excalidraw-style canvas application for sketching, visualizing, and human-like stepping through of LeetCode data structures and algorithm states.

## Key Features

- **Interactive Canvas:** Draw, connect, and reposition data structures like Linked Lists, Arrays, and Binary Trees.
- **LeetCode Integration:** Load locally stored example inputs by problem number and sketch selected cases on the canvas.
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
   cd step-sketch
   ```

## LeetCode Sketch data and backend

The browser requests a single LeetCode Sketch problem at a time from
`GET /api/leetcode-sketch/problems/:number`. The Node backend reads only
`data/processed/leetcode-sketch-problems-v1.json` at runtime and returns the
matching **LeetCode Sketch** record. That file contains our generated input
shape classifications, not LeetCode's raw API response. The raw LeetCode source
file is used only as input to the maintenance/generation scripts, never by the
app or backend API.
The `scripts/` directory contains maintenance tools and is not served to
website users.

In development, Vite hosts the API middleware alongside the frontend. For
production, build and run the Node server so it serves the frontend and API
together:

```bash
npm run build
npm start
```

Set `PORT` to change the production server's default port (`4173`). Deploy the
`server/` code and the LeetCode Sketch dataset together with the frontend.

### Refreshing the LeetCode Sketch dataset

The source-fetcher in `scripts/fetch-leetcode-source.mjs` downloads LeetCode's
raw problem descriptions and example inputs into
`data/source/leetcode-problems-api.json`. The LeetCode Sketch generator in
`scripts/generate-leetcode-sketch-data.mjs` classifies those inputs into shapes
and writes the app's LeetCode Sketch dataset using the Gemini API. Its instructions
are maintained in `scripts/leetcode-sketch-data-prompt.md`.

The input is an array (or an object with a `problems` array). Each item must have
`questionId`, `title`, `titleSlug`, `description`, and either `examples` (an
array of strings) or `exampleTestcases` (a string). `signature` is optional.
The default source path is `data/source/leetcode-problems-api.json`. To fetch
the first 1,000:

```bash
npm run fetch:leetcode-source
```

With no `--limit`, the source-fetcher saves the first 1,000 indexed problems
in ascending problem-number order. This downloads descriptions and examples
only for non-premium problems; it also records premium-only problem IDs from
LeetCode's index without requesting their descriptions. It does not make any
Gemini requests. Use `--limit 40` for a smaller source-fetch test.

To refresh or expand the generated dataset, set `GEMINI_API_KEY` and
`GEMINI_MODEL` in `.env.local` (the key can be created in Google AI Studio).
The generation command requires Node.js 20.6 or newer for its `.env.local`
loading option. After source fetching succeeds, select only the problems that
need LLM analysis:

```bash
npm run generate:leetcode-sketch -- --ids 23,94,133
```

`--ids` accepts a comma-separated list of exact problem numbers and cannot be
combined with `--limit`. The requested IDs must exist in the fetched source
file; otherwise the script stops before making Gemini requests. Existing
generated records with shape labels are skipped unless `--force` is supplied,
so rerunning can continue a partial batch. Records without per-input `shape`
labels are regenerated when selected. Optional flags are `--input`, `--output`,
`--limit`, `--ids`, `--concurrency`, `--retries`, and `--force`.
Successful records are written to
`data/processed/leetcode-sketch-problems-v1.json`. Failed records are written to
the adjacent `.errors.json` report and cause a non-zero exit; a rerun retries
them while skipping already generated IDs.
Premium-only IDs from LeetCode's index are copied into the LeetCode Sketch
dataset and are not sent to Gemini. The API uses that metadata to explain when
a requested problem is unavailable because of LeetCode Premium. Re-run both
the source fetch and generator to refresh premium availability metadata.

The source-fetcher accepts `--limit`, `--output`, `--retries`, and `--delay`
(milliseconds between question requests). It retrieves problems in ascending
question-number order and resumes by skipping IDs already in the source file.

The LeetCode Sketch dataset must be present on the backend at deployment time.
Raw LeetCode source data is only needed when running the maintenance scripts.
The LeetCode Sketch dataset remains repository-managed and is not exposed as a
static browser asset. The API supports only IDs present in that dataset. The
generated output has this shape:

```json
{
  "dataset": "leetcode-sketch",
  "schemaVersion": 2,
  "generatedAt": "2026-10-11T00:00:00.000Z",
  "generator": { "provider": "google-gemini", "model": "your-model" },
  "premiumProblems": [{ "questionId": 296, "titleSlug": "best-meeting-point" }],
  "problems": {
    "1": {
      "questionId": 1,
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "testCases": [
        {
          "inputs": [
            {
              "name": "nums",
              "value": [2, 7, 11, 15],
              "shape": "array",
              "nodeStructure": null
            },
            {
              "name": "target",
              "value": 9,
              "shape": "scalar",
              "nodeStructure": null
            }
          ]
        }
      ]
    }
  }
}
```
