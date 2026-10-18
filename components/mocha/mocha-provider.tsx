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

export interface AdvancedProcessingSettings {
  dpi?: number
  compressionLevel?: 'extreme' | 'balanced' | 'low' | string
  colorMode?: 'rgb' | 'grayscale' | 'mono' | string
  removeJs?: boolean
  cleanMetadata?: boolean
  linearize?: boolean
  targetPages?: number[]
  secondaryFileId?: string
  reviewText?: string
  reviewerName?: string
  ownerPassword?: string
  userPassword?: string
  allowPrinting?: boolean
  allowCopying?: boolean
  pdfaCompliance?: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b' | string
}

type RunOptions = {
  params?: OperationParams
  settings?: AdvancedProcessingSettings
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
  uploadProgress: number
  timeRemaining: string
  lastRun: RunMetrics | null
  isReadyForProcessing: boolean // 🟢 مؤشر صارم لمدى جاهزية الملف المعالج في السحابة
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
  const [timeRemaining, setTimeRemaining] = useState<string>('جاهز')
  const [lastRun, setLastRun] = useState<RunMetrics | null>(null)
  
  const [cloudFileId, setCloudFileId] = useState<string | null>(null)
  const [isReadyForProcessing, setIsReadyForProcessing] = useState<boolean>(false) // 🟢 الحالة الصارمة
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
      setIsReadyForProcessing(false) // 🔒 قفل العمليات فوراً عند بدء اختيار ملف جديد
      setUploadProgress(0)
      setTimeRemaining('جاري الرفع للسحابة...')
      log('info', `بدء رفع وتأمين الملف ${next.name} في خزنة جوجل درايف…`)

      try {
        const [inspectResult, engineRes] = await Promise.all([
          inspectPdf(next),
          uploadEngineFile(next, 'upload', (progress) => {
            setUploadProgress(progress)
          }),
        ])

        setInfo(inspectResult)
        
        if (engineRes && engineRes.fileId) {
          setCloudFileId(engineRes.fileId)
        } else if (engineRes && engineRes.viewUrl) {
          setCloudFileId(engineRes.viewUrl)
        }

        setUploadProgress(100)
        setIsReadyForProcessing(true) // 🔓 فتح أزرار العمليات فقط بعد التأكد من اكتمال الرفع واستقرار الخزنة
        setTimeRemaining('مكتمل وتم استقرار الخزنة')
        log('success', `تم رفع وفحص ${next.name} بنجاح في الخزنة السحابية — ${inspectResult.pages} صفحة`)
      } catch (err: any) {
        setInfo(null)
        setIsReadyForProcessing(false)
        log('error', err.message || 'تعذّر رفع الملف إلى الخزنة السحابية.')
      } finally {
        setInspecting(false)
      }
    },
    [log],
  )

  const clearFile = useCallback(() => {
    setFile(null)
    setInfo(null)
    setCloudFileId(null)
    setIsReadyForProcessing(false)
    setUploadProgress(0)
    setTimeRemaining('جاهز')
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
    async (operation, label, { params, settings, extraFiles, autoDownload = true } = {}) => {
      if (!file || !isReadyForProcessing) {
        log('error', 'يجب اكتمال رفع الملف واستقرار الخزنة السحابية أولاً قبل تنفيذ أي عملية.')
        return null
      }
      setBusyOp(operation)
      log('info', `جاري تنفيذ عملية (${label}) وتطبيق القيود الصارمة عبر المحرك السحابي…`)
      
      const started = performance.now()

      try {
        const apiRes = await processPdf({
          action: 'process_operation',
          operation: operation,
          fileId: cloudFileId || undefined,
          params: params || {},
          settings: settings || {},
        })

        if (!apiRes.success) {
          throw new Error(apiRes.error || 'فشلت عملية معالجة المستند على السيرفر.')
        }

        const durationMs = Math.round(performance.now() - started)
        const bytesIn = file.size + (extraFiles?.reduce((sum, f) => sum + f.size, 0) ?? 0)
        const url = apiRes.downloadUrl || ''
        const finalSize = apiRes.size || file.size

        setVault((prev) => [
          {
            id: uid(),
            filename: apiRes.filename || file.name,
            size: finalSize,
            operation,
            label,
            createdAt: Date.now(),
            url,
            durationMs,
          },
          ...prev,
        ])

        if (autoDownload && url) {
          triggerDownload(url, apiRes.filename || file.name)
        }

        setLastRun({ operation, durationMs, bytesIn, bytesOut: finalSize })
        log('success', `${label}: تمت المعالجة الصارمة وتحديث بايتات الملف بنجاح في ${durationMs}ms`)

        const mockBlob = new Blob([], { type: 'application/pdf' })

        return {
          kind: 'file',
          filename: apiRes.filename || file.name,
          blob: mockBlob,
        }
      } catch (error) {
        log('error', error instanceof Error ? error.message : 'خطأ أثناء تنفيذ العملية السحابية الصارمة')
        return null
      } finally {
        setBusyOp(null)
      }
    },
    [file, cloudFileId, isReadyForProcessing, log],
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
      isReadyForProcessing, // 🟢 إتاحة حالة الجاهزية للمكونات الخارجية
      run,
      openFilePicker: () => pickerRef.current(),
      registerFilePicker: (open) => {
        pickerRef.current = open
      },
    }),
    [file, info, inspecting, loadFile, clearFile, endpoint, vault, removeFromVault, clearVault, logs, log, busyOp, uploadProgress, timeRemaining, lastRun, isReadyForProcessing, run],
  )

  return <MochaContext.Provider value={value}>{children}</MochaContext.Provider>
}

export function useMocha() {
  const ctx = useContext(MochaContext)
  if (!ctx) throw new Error('useMocha must be used within MochaProvider')
  return ctx
}