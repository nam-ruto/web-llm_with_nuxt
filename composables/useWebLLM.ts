import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import {
  CreateMLCEngine,
  type ChatCompletionChunk,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type MLCEngine
} from '@mlc-ai/web-llm'

const DEFAULT_MODEL_ID = 'SmolLM2-1.7B-Instruct-q4f16_1-MLC'

const extractText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (part && typeof part === 'object' && 'text' in part) {
          const textPart = (part as Record<string, unknown>).text
          return typeof textPart === 'string' ? textPart : ''
        }

        return ''
      })
      .join('')
  }

  return ''
}

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const useWebLLM = (model = DEFAULT_MODEL_ID) => {
  const modelId = ref(model)
  const engine = shallowRef<MLCEngine | null>(null)
  const isLoadingModel = ref(false)
  const loadProgress = ref<InitProgressReport | null>(null)
  const errorMessage = ref<string | null>(null)
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
      return 'success'
    }
    if (isLoadingModel.value) {
      return 'warning'
    }
    return 'neutral'
  })

  const loadModel = async () => {
    if (isLoadingModel.value || engine.value) {
      return
    }

    errorMessage.value = null
    isLoadingModel.value = true
    loadProgress.value = null

    try {
      engine.value = await CreateMLCEngine(modelId.value, {
        initProgressCallback: (report: InitProgressReport) => {
          loadProgress.value = report
        }
      })
    } catch (error) {
      const message = toErrorMessage(error)
      errorMessage.value = `Failed to load model: ${message}`
      throw error
    } finally {
      isLoadingModel.value = false
    }
  }

  const sendMessage = async (input: string) => {
    if (!engine.value) {
      errorMessage.value = 'Model is not loaded yet.'
      throw new Error('Model is not loaded yet.')
    }

    if (isGenerating.value) {
      return
    }

    const trimmed = input.trim()
    if (!trimmed) {
      return
    }

    const userMessage: ChatCompletionMessageParam = {
      role: 'user',
      content: trimmed
    }

    conversation.value = [...conversation.value, userMessage]
    errorMessage.value = null
    isGenerating.value = true

    const requestMessages = conversation.value.slice()
    const assistantBase: ChatCompletionMessageParam = {
      role: 'assistant',
      content: ''
    }

    let assistantIndex: number | null = null

    try {
      const stream = await engine.value.chat.completions.create({
        messages: requestMessages,
        stream: true
      })

      conversation.value.push({ ...assistantBase })
      assistantIndex = conversation.value.length - 1

      const updateAssistant = (delta: unknown) => {
        if (assistantIndex === null || assistantIndex < 0) {
          return
        }

        const text = extractText(delta)
        if (!text) {
          return
        }

        const current = conversation.value[assistantIndex]
        const existingContent = typeof current?.content === 'string' ? current.content : ''

        conversation.value[assistantIndex] = {
          role: 'assistant',
          content: `${existingContent}${text}`
        }
      }

      for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
        const delta = chunk.choices?.[0]?.delta?.content
        updateAssistant(delta)
      }

      return assistantIndex !== null ? conversation.value[assistantIndex]?.content ?? '' : ''
    } catch (error) {
      const message = toErrorMessage(error)
      errorMessage.value = `Failed to generate response: ${message}`

      if (assistantIndex !== null && conversation.value[assistantIndex]) {
        conversation.value.splice(assistantIndex, 1)
      }

      throw error
    } finally {
      isGenerating.value = false
    }
  }

  const resetConversation = () => {
    conversation.value = []
  }

  onBeforeUnmount(() => {
    if (engine.value) {
      engine.value.unload().catch((error) => {
        console.warn('Failed to unload model', error)
      })
    }
  })

  return {
    modelId,
    engine,
    isReady,
    statusLabel,
    statusColor,
    isLoadingModel,
    loadProgress,
    errorMessage,
    conversation,
    isGenerating,
    loadModel,
    sendMessage,
    resetConversation
  }
}

