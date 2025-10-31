<template>
  <UContainer class="py-12">
    <div class="mx-auto max-w-3xl space-y-6">
      <UCard>
        <template #header>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 class="text-xl font-semibold">WebLLM Assistant</h1>
              <p class="text-sm text-neutral-400">Model: {{ modelId }}</p>
            </div>
            <UBadge :color="statusColor" variant="soft" class="w-fit">
              {{ statusLabel }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <UButton
              icon="i-heroicons-cpu-chip"
              size="lg"
              :loading="isLoadingModel"
              :disabled="isLoadingModel || isReady"
              @click="loadModel"
            >
              {{ isReady ? 'Model Loaded' : 'Load Model' }}
            </UButton>
            <div class="text-sm text-neutral-400 sm:flex-1">
              <p v-if="isLoadingModel && loadProgress">
                Loading… {{ Math.round(loadProgress.progress * 100) }}% — {{ loadProgress.text }}
              </p>
              <p v-else-if="isReady">Ready to chat.</p>
              <p v-else>Click the button to download and initialize the model.</p>
            </div>
          </div>

          <UAlert
            v-if="loadError"
            color="rose"
            icon="i-heroicons-exclamation-triangle"
            variant="subtle"
          >
            {{ loadError }}
          </UAlert>

          <div class="space-y-4">
            <div
              v-if="conversation.length"
              class="space-y-4 max-h-96 overflow-y-auto rounded-lg border border-neutral-800/60 bg-neutral-950/60 p-4"
            >
              <div
                v-for="(message, index) in conversation"
                :key="index"
                class="flex flex-col gap-1 rounded-md border border-neutral-800/80 bg-neutral-900/70 p-3"
              >
                <span class="text-xs font-semibold uppercase text-neutral-400">
                  {{ message.role === 'assistant' ? 'Assistant' : 'You' }}
                </span>
                <p class="whitespace-pre-line text-sm leading-relaxed text-neutral-100">
                  {{ renderMessageContent(message.content) }}
                </p>
              </div>
            </div>
            <p v-else class="text-sm text-neutral-500">
              Conversation history will appear here after you send a message.
            </p>
          </div>

          <form class="space-y-3" @submit.prevent="handleSubmit">
            <UFormGroup label="Your message" name="prompt">
              <UTextarea
                v-model="prompt"
                :disabled="!isReady || isGenerating"
                placeholder="Ask the assistant anything..."
                :rows="4"
              />
            </UFormGroup>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs text-neutral-500">
                {{ isReady ? 'Press Enter or click Send to submit your question.' : 'Load the model to start chatting.' }}
              </p>
              <UButton
                type="submit"
                color="primary"
                variant="solid"
                :disabled="!isReady || !prompt.trim() || isGenerating"
                :loading="isGenerating"
                icon="i-heroicons-paper-airplane"
              >
                Send
              </UButton>
            </div>
          </form>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import {
  CreateMLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type MLCEngine
} from '@mlc-ai/web-llm'

const modelId = 'SmolLM2-1.7B-Instruct-q4f16_1-MLC'

const engine = shallowRef<MLCEngine | null>(null)
const isLoadingModel = ref(false)
const loadProgress = ref<InitProgressReport | null>(null)
const loadError = ref<string | null>(null)
const prompt = ref('')
const conversation = ref<ChatCompletionMessageParam[]>([])
const isGenerating = ref(false)

const isReady = computed(() => engine.value !== null)
const statusLabel = computed(() => {
  if (isReady.value) {
    return 'Ready'
  }
  if (isLoadingModel.value) {
    return 'Loading model'
  }
  return 'Not loaded'
})
const statusColor = computed(() => {
  if (isReady.value) {
    return 'emerald'
  }
  if (isLoadingModel.value) {
    return 'amber'
  }
  return 'gray'
})

const updateProgress = (report: InitProgressReport) => {
  loadProgress.value = report
}

const loadModel = async () => {
  if (isLoadingModel.value || engine.value) {
    return
  }

  loadError.value = null
  isLoadingModel.value = true
  loadProgress.value = null

  try {
    engine.value = await CreateMLCEngine(modelId, {
      initProgressCallback: updateProgress
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    loadError.value = `Failed to load model: ${message}`
  } finally {
    isLoadingModel.value = false
  }
}

const handleSubmit = async () => {
  if (!isReady.value || isGenerating.value) {
    return
  }

  const value = prompt.value.trim()
  if (!value) {
    return
  }

  const userMessage: ChatCompletionMessageParam = {
    role: 'user',
    content: value
  }

  conversation.value = [...conversation.value, userMessage]
  prompt.value = ''
  loadError.value = null
  isGenerating.value = true

  try {
    const response = await engine.value!.chat.completions.create({
      messages: conversation.value
    })

    const rawContent = response.choices?.[0]?.message?.content
    const assistantText = normalizeContent(rawContent)

    if (assistantText) {
      conversation.value = [...conversation.value, { role: 'assistant', content: assistantText }]
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    loadError.value = `Failed to generate response: ${message}`
  } finally {
    isGenerating.value = false
  }
}

const renderMessageContent = (content: ChatCompletionMessageParam['content']) => {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => ('text' in part && part.text ? part.text : ''))
      .join('\n')
  }
  return ''
}

const normalizeContent = (content: unknown) => {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'object' && part && 'text' in part ? (part as { text?: string }).text ?? '' : ''))
      .join('\n')
      .trim()
  }
  return ''
}

onBeforeUnmount(async () => {
  if (engine.value) {
    try {
      await engine.value.unload()
    } catch (error) {
      console.warn('Failed to unload model', error)
    }
  }
})
</script>

