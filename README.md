# WebLLM Nuxt Assistant

This project is a minimal Nuxt 4 application that runs entirely in the browser and exposes a small chat UI for the `SmolLM2-1.7B-Instruct-q4f16_1-MLC` model using [WebLLM](https://github.com/mlc-ai/web-llm). Nuxt UI provides the prebuilt components for the interface; WebGPU (via WebLLM) powers the local inference.

## Features

- One-click model loader with progress feedback and error messaging
- Stateless OpenAI-style chat flow handled in-browser through WebLLM
- Conversation history rendered with Nuxt UI components (`UCard`, `UTextarea`, `UButton`, `UBadge`, `UAlert`)
- Clean dark theme wrapper using Nuxt UI’s `UApp`

## Requirements

- Node.js 18.17+ (recommended: latest LTS)
- pnpm (project lockfile is managed with pnpm)
- A WebGPU-capable browser (Chrome/Edge ≥ 113, Safari Technology Preview, or compatible)

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server (defaults to `http://localhost:3000`):

```bash
pnpm dev
```

### Custom Port or Host

Nuxt reads `NUXT_PORT` and `NUXT_HOST` at runtime. To run on port 4000:

```bash
NUXT_PORT=4000 pnpm dev
```

> On Windows Command Prompt use `set NUXT_PORT=4000 && pnpm dev`.

## Usage

1. Open the app in a WebGPU-enabled browser.
2. Click **Load Model**. The initial download can take a couple of minutes.
3. Watch the progress indicator to know when the model is ready.
4. Enter a prompt and press **Send** to receive a response from the assistant.

All model execution happens locally in the browser; no server-side inference is involved.

## WebLLM Integration

- The chat page calls `CreateMLCEngine(modelId, { initProgressCallback })` to download and initialize the `SmolLM2-1.7B-Instruct-q4f16_1-MLC` weights inside the browser.
- Progress updates from WebLLM are stored in local state and rendered in the UI so users see download percentage and status text.
- User prompts are appended to a message array compatible with WebLLM’s OpenAI-style API, and we invoke `engine.chat.completions.create({ messages })` for each turn.
- The assistant response is normalized to plain text and appended to the conversation history for display.
- When the page is left, `engine.unload()` runs during `onBeforeUnmount` to release WebGPU resources and cached state for the session.

## Project Structure

- `app/app.vue` – Nuxt UI root wrapper (`UApp`) and global page shell
- `app/pages/index.vue` – Chat UI, model loading logic, and conversation handling
- `nuxt.config.ts` – Nuxt configuration enabling Nuxt UI module

## Production Build

Build the app:

```bash
pnpm build
```

Preview the production bundle locally:

```bash
pnpm preview
```

Deploy the generated output using any static or edge-friendly host that supports Nuxt’s output mode. Consult the [Nuxt deployment guide](https://nuxt.com/docs/getting-started/deployment) for provider-specific steps.

## Troubleshooting

- **WebGPU unavailable**: Ensure you are on a supported browser and HTTPS (or `localhost`).
- **Model load failures**: Refresh and retry; you can clear browser storage to remove partially cached weights.
- **Slow first load**: The initial download is several hundred MB. Subsequent loads reuse the browser cache.

## Resources

- [WebLLM documentation](https://webllm.mlc.ai/docs/)
- [Nuxt UI documentation](https://ui.nuxt.com/docs/components/button)
- [Nuxt 4 documentation](https://nuxt.com/docs/getting-started/introduction)
