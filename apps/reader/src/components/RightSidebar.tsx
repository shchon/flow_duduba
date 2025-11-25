import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { MdClose } from 'react-icons/md'

import { useMobile } from '../hooks'
import { useAiState } from '../state'

import { useSplitViewItem } from './base'

type TabKey = 'dictionary' | 'ai'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dictionary', label: 'Dictionary' },
  { key: 'ai', label: 'AI Explanation' },
]

export const RightSidebar: React.FC = () => {
  const mobile = useMobile()
  const [aiState, setAiState] = useAiState()
  const [isOpen, setIsOpen] = useState(false)

  const activeTab: TabKey = useMemo(
    () => (aiState.sidebarMode as TabKey) || 'dictionary',
    [aiState.sidebarMode],
  )

  const hasWord = !!aiState.selectedWord

  // Open sidebar when word is selected
  useEffect(() => {
    if (hasWord) {
      setIsOpen(true)
    }
  }, [hasWord])

  const { size } = useSplitViewItem(RightSidebar, {
    preferredSize: 320,
    minSize: 220,
    visible: isOpen,
  })

  if (mobile || !isOpen) return null

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(() => {
      setAiState((prev) => ({
        ...prev,
        selectedWord: undefined,
      }))
    }, 300)
  }

  return (
    <div
      className="RightSidebar bg-surface flex flex-col border-l border-surface-variant"
      style={{ width: size }}
    >
      <div className="flex items-center justify-between border-b-2 border-outline/20 bg-surface shadow-sm">
        <div className="flex flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={clsx(
                'flex-1 px-4 py-3 text-sm font-medium transition-all relative',
                activeTab === tab.key
                  ? 'text-primary bg-primary/10'
                  : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface',
              )}
              onClick={() =>
                setAiState((prev) => ({
                  ...prev,
                  sidebarMode: tab.key,
                }))
              }
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
        <button
          className="px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors"
          onClick={handleClose}
          title="Close"
        >
          <MdClose size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dictionary' && <DictionaryView word={aiState.selectedWord} />}
        {activeTab === 'ai' && <AiExplanationView word={aiState.selectedWord} />}
      </div>
    </div>
  )
}

interface ViewProps {
  word?: string
}

const DictionaryView: React.FC<ViewProps> = ({ word }) => {
  const [aiState, setAiState] = useAiState()
  const [adding, setAdding] = useState(false)

  if (!word) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-outline">
        Select a word to see dictionary
      </div>
    )
  }

  const src = `https://cn.bing.com/dict/search?q=${encodeURIComponent(word)}`

  const handleAdd = async () => {
    if (adding) return

    // If AI config is not ready, at least save the word itself
    const { baseUrl, apiKey, model } = aiState.config
    const context = aiState.context ?? word

    if (!baseUrl || !apiKey || !model) {
      setAiState((prev) => {
        if (prev.vocabulary.some((v) => v.word === word)) return prev
        return {
          ...prev,
          vocabulary: [...prev.vocabulary, { word }],
        }
      })
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/ai-explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, context, config: aiState.config }),
      })

      let explanation: string | undefined
      if (res.ok) {
        const data = await res.json()
        explanation = data.explanation
      }

      setAiState((prev) => {
        if (prev.vocabulary.some((v) => v.word === word)) return prev
        return {
          ...prev,
          vocabulary: [...prev.vocabulary, { word, explanation }],
        }
      })
    } catch {
      // On error, still save the word without explanation
      setAiState((prev) => {
        if (prev.vocabulary.some((v) => v.word === word)) return prev
        return {
          ...prev,
          vocabulary: [...prev.vocabulary, { word }],
        }
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-variant px-3 py-2 text-sm text-on-surface-variant">
        <span className="font-medium">{word}</span>
        <button
          className="rounded bg-primary px-3 py-1 text-xs text-on-primary hover:opacity-90"
          onClick={handleAdd}
          disabled={adding}
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>
      <iframe
        title="Bing Dictionary"
        src={src}
        className="h-full w-full flex-1 border-0"
      />
    </div>
  )
}

const AiExplanationView: React.FC<ViewProps> = ({ word }) => {
  const [aiState, setAiState] = useAiState()
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<string>()

  const { baseUrl, apiKey, model } = aiState.config
  const context = aiState.context ?? word

  useEffect(() => {
    if (!word) return
    if (!baseUrl || !apiKey || !model) {
      setExplanation('Please configure AI settings (base URL, API key, model).')
      setLoading(false)
      return
    }

    setLoading(true)
    setExplanation(undefined)

    fetch('/api/ai-explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word, context, config: aiState.config }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || res.statusText)
        }
        const data = await res.json()
        setExplanation(data.explanation)
      })
      .catch((e) => {
        setExplanation(String(e))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [word, baseUrl, apiKey, model, context, aiState.config])

  if (!word) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-outline">
        Select a word to see AI explanation
      </div>
    )
  }

  const handleAdd = () => {
    if (!word || !explanation) return
    setAiState((prev) => {
      if (prev.vocabulary.some((v) => v.word === word)) return prev
      return {
        ...prev,
        vocabulary: [...prev.vocabulary, { word, explanation }],
      }
    })
  }

  return (
    <div className="flex h-full flex-col p-4 text-sm text-on-surface-variant">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-base font-medium">{word}</div>
        <button
          className="rounded bg-primary px-3 py-1 text-xs text-on-primary hover:opacity-90 disabled:opacity-50"
          onClick={handleAdd}
          disabled={!explanation}
        >
          Add
        </button>
      </div>
      {loading && (
        <div className="mb-2 text-xs text-outline">Loading AI explanation...</div>
      )}
      {explanation && (
        <div className="scroll-parent flex-1 overflow-auto rounded bg-surface-variant/30 p-3">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {explanation}
          </div>
        </div>
      )}
      {!loading && !explanation && (
        <p className="text-xs text-outline">No explanation yet.</p>
      )}
    </div>
  )
}
