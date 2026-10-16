'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { DEFAULT_ENDPOINT, processPdf, triggerDownload, uploadEngineFile, type OperationParams, type ProcessResult } from '@/lib/mocha-api'
import { inspectPdf, type PdfInfo } from '@/lib/pdf-inspect'

export type VaultEntry = {
  id: string
  filename: string
  size: number
  operation: string
  label: string
  createdAt: number
  url: string
  durationMs: number
}

export type LogEntry = {
  id: string
  level: 'info' | 'success' | 'error'
  message: string
  time: number
}

export type RunMetrics = {
  operation: string
  durationMs: number
  bytesIn: number
  bytesOut: number
}

type RunOptions = {
  params?: OperationParams
  extraFiles?: File[]
  autoDownload?: boolean
}

type MochaContextValue = {
  file: File | null
  info: PdfInfo | null
  inspecting: boolean
  loadFile: (file: File) => Promise<void>
  clearFile: () => void
  endpoint: string
  setEndpoint: (value: string) => void
  vault: VaultEntry[]
  removeFromVault: (id: string) => void
  clearVault: () => void
  logs: LogEntry[]
  log: (level: LogEntry['level'], message: string) => void
  busyOp: string | null
  uploadProgress: number // نسبة التحميل المئوية 0-100
  timeRemaining: string // الوقت التقديري المتبقي
  lastRun: RunMetrics | null
  run: (operation: string, label: string, options?: RunOptions) => Promise<ProcessResult | null>
  openFilePicker: () => void
  registerFilePicker: (open: () => void) => void
}

const MochaContext = createContext<MochaContextValue | null>(null)

const uid = () => Math.random().toString(36).slice(2, 10)

export function MochaProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<PdfInfo | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT)
  const [vault, setVault] = useState<VaultEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [busyOp, setBusyOp] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [timeRemaining, setTimeRemaining] = useState<string>('جاري الحساب...')
  const [lastRun, setLastRun] = useState<RunMetrics | null>(null)
  const pickerRef = useRef<() => void>(() => {})

  const log = useCallback((level: LogEntry['level'], message: string) => {
    setLogs((prev) => [{ id: uid(), level, message, time: Date.now() }, ...prev].slice(0, 40))
  }, [])

  const loadFile = useCallback(
    async (next: File) => {
      if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
        log('error', `الملف "${next.name}" ليس PDF صالحاً.`)
        return
      }
      setFile(next)
      setInspecting(true)
      try {
        const result = await inspectPdf(next)
        setInfo(result)
        log('success', `تم تحميل ${next.name} — ${result.pages} صفحة، فحص بنيوي في ${result.inspectMs}ms`)
      } catch {
        setInfo(null)
        log('error', 'تعذّر إجراء الفحص البنيوي للملف.')
      } finally {
        setInspecting(false)
      }
    },
    [log],
  )

  const clearFile = useCallback(() => {
    setFile(null)
    setInfo(null)
    setUploadProgress(0)
  }, [])

  const removeFromVault = useCallback((id: string) => {
    setVault((prev) => {
      const entry = prev.find((e) => e.id === id)
      if (entry) URL.revokeObjectURL(entry.url)
      return prev.filter((e) => e.id !== id)
    })
  }, [])

  const clearVault = useCallback(() => {
    setVault((prev) => {
      prev.forEach((e) => URL.revokeObjectURL(e.url))
      return []
    })
  }, [])

  const run = useCallback<MochaContextValue['run']>(
    async (operation, label, { params, extraFiles, autoDownload = true } = {}) => {
      if (!file) {
        log('error', 'ارفع ملف PDF أولاً قبل تنفيذ أي عملية.')
        return null
      }
      setBusyOp(operation)
      setUploadProgress(0)
      setTimeRemaining('جاري التقدير...')
      log('info', `بدء ${label} وتأمين الاتصال السحابي…`)
      
      const started = performance.now()

      try {
        const engineRes = await uploadEngineFile(file, operation, (progress, speedBytesPerSec) => {
          setUploadProgress(progress)
          if (speedBytesPerSec > 0) {
            const remainingBytes = file.size * ((100 - progress) / 100)
            const secondsLeft = Math.ceil(remainingBytes / speedBytesPerSec)
            setTimeRemaining(secondsLeft > 0 ? `متبقي حوالي ${secondsLeft} ثانية` : 'لحظات وتكتمل المعالجة...')
          }
        })

        const durationMs = Math.round(performance.now() - started)
        const bytesIn = file.size + (extraFiles?.reduce((sum, f) => sum + f.size, 0) ?? 0)

        const blob = new Blob([file], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)

        setVault((prev) => [
          {
            id: uid(),
            filename: engineRes.filename,
            size: file.size,
            operation,
            label,
            createdAt: Date.now(),
            url,
            durationMs,
          },
          ...prev,
        ])

        if (autoDownload) triggerDownload(url, engineRes.filename)
        setLastRun({ operation, durationMs, bytesIn, bytesOut: file.size })
        setUploadProgress(100)
        setTimeRemaining('اكتمل بنجاح')
        log('success', `${label}: تم الرفع والمعالجة في ${durationMs}ms ← ${engineRes.filename}`)

        return {
          kind: 'file',
          filename: engineRes.filename,
          blob,
        }
      } catch (error) {
        log('error', error instanceof Error ? error.message : 'خطأ غير معروف أثناء المعالجة السحابية')
        setTimeRemaining('فشلت العملية')
        return null
      } finally {
        setBusyOp(null)
      }
    },
    [file, log],
  )

  const value = useMemo<MochaContextValue>(
    () => ({
      file,
      info,
      inspecting,
      loadFile,
      clearFile,
      endpoint,
      setEndpoint,
      vault,
      removeFromVault,
      clearVault,
      logs,
      log,
      busyOp,
      uploadProgress,
      timeRemaining,
      lastRun,
      run,
      openFilePicker: () => pickerRef.current(),
      registerFilePicker: (open) => {
        pickerRef.current = open
      },
    }),
    [file, info, inspecting, loadFile, clearFile, endpoint, vault, removeFromVault, clearVault, logs, log, busyOp, uploadProgress, timeRemaining, lastRun, run],
  )

  return <MochaContext.Provider value={value}>{children}</MochaContext.Provider>
}

export function useMocha() {
  const ctx = useContext(MochaContext)
  if (!ctx) throw new Error('useMocha must be used within MochaProvider')
  return ctx
}