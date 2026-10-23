'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { PdfInfo } from '@/lib/pdf-inspect'

export type LocalPdfFile = {
  path: string
  name: string
  size: number
  type: string
  lastModified: number
}

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
  targetPages?: number[]
  pageOrder?: number[]
  secondaryFilePath?: string
  secondaryFilePaths?: string[]
  ownerPassword?: string
  userPassword?: string
  allowPrinting?: boolean
  allowCopying?: boolean
  pdfaCompliance?: string
  startPage?: number
  endPage?: number
  removeJs?: boolean
  cleanMetadata?: boolean
  allowModify?: boolean
  reviewText?: string
  reviewerName?: string
}

type RunOptions = {
  params?: Record<string, unknown>
  settings?: AdvancedProcessingSettings
  autoDownload?: boolean
}

export type ProcessResult = | { kind: 'file'; filename: string; path: string; size: number } | { kind: 'json'; data: Record<string, unknown> }

type MochaContextValue = {
  file: LocalPdfFile | null
  info: PdfInfo | null
  inspecting: boolean
  loadFile: (path: string) => Promise<void>
  clearFile: () => void
  vault: VaultEntry[]
  removeFromVault: (id: string) => void
  clearVault: () => void
  logs: LogEntry[]
  log: (level: LogEntry['level'], message: string) => void
  busyOp: string | null
  uploadProgress: number
  timeRemaining: string
  lastRun: RunMetrics | null
  isReadyForProcessing: boolean
  run: (operation: string, label: string, options?: RunOptions) => Promise<ProcessResult | null>
  openFilePicker: () => Promise<void>
}

const MochaContext = createContext<MochaContextValue | null>(null)
const uid = () => Math.random().toString(36).slice(2, 10)

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || 'document.pdf'
}

export function MochaProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<LocalPdfFile | null>(null)
  const [info, setInfo] = useState<PdfInfo | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [vault, setVault] = useState<VaultEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [busyOp, setBusyOp] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState('جاهز')
  const [lastRun, setLastRun] = useState<RunMetrics | null>(null)

  const log = useCallback((level: LogEntry['level'], message: string) => {
    setLogs((prev) => [{ id: uid(), level, message, time: Date.now() }, ...prev].slice(0, 40))
  }, [])

  const loadFile = useCallback(async (path: string) => {
    if (!path.toLowerCase().endsWith('.pdf')) {
      log('error', 'اختر ملفاً بامتداد PDF.')
      return
    }
    setInspecting(true)
    setUploadProgress(0)
    setTimeRemaining('فحص الملف محلياً')
    try {
      const result = await invoke<{ path: string; sizeBytes: number; exists: boolean; pages: number; version: string; encrypted: boolean; objects: number; images: number; fonts: number; hasForms: boolean; hasJavaScript: boolean; linearized: boolean; producer: string | null }>(
        'get_pdf_file_info',
        { params: { input_path: path } },
      )
      if (!result.exists) throw new Error('لم يؤكد المحرك وجود الملف.')
      setInfo({ name: fileName(path), sizeBytes: result.sizeBytes, pages: result.pages, version: result.version, encrypted: result.encrypted, objects: result.objects, images: result.images, fonts: result.fonts, hasForms: result.hasForms, hasJavaScript: result.hasJavaScript, linearized: result.linearized, producer: result.producer, inspectMs: 0 })
      setFile({
        path,
        name: fileName(path),
        size: result.sizeBytes,
        type: 'application/pdf',
        lastModified: Date.now(),
      })
      setUploadProgress(100)
      setTimeRemaining('جاهز للمعالجة المحلية')
      log('success', 'تم اختيار ' + fileName(path) + ' وفحص حجمه محلياً.')
    } catch (error) {
      setFile(null)
      setInfo(null)
      setUploadProgress(0)
      setTimeRemaining('تعذر فتح الملف')
      log('error', error instanceof Error ? error.message : String(error))
    } finally {
      setInspecting(false)
    }
  }, [log])

  const openFilePicker = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: 'اختر ملف PDF',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (typeof selected === 'string') await loadFile(selected)
    } catch (error) {
      log('error', error instanceof Error ? error.message : String(error))
    }
  }, [loadFile, log])

  const clearFile = useCallback(() => {
    setFile(null)
    setInfo(null)
    setUploadProgress(0)
    setTimeRemaining('جاهز')
  }, [])

  const removeFromVault = useCallback((id: string) => {
    setVault((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const clearVault = useCallback(() => setVault([]), [])

  const run = useCallback<MochaContextValue['run']>(
    async (operation, label, { params = {}, settings = {} } = {}) => {
      try {
        const admin = JSON.parse(localStorage.getItem('mocha-pro-admin-settings-v1') || '{}') as { commandsEnabled?: boolean }
        if (admin.commandsEnabled === false) { log('error', 'أوقف المدير تنفيذ الأوامر على هذا الجهاز.'); return null }
      } catch { /* allow normal operation when no local settings exist */ }
      if (!file) {
        log('error', 'اختر ملف PDF أولاً.')
        return null
      }

      let command: string
      let inputPath = file.path
      let options: Record<string, unknown> = {}
      let outputExtension = 'pdf'
      switch (operation) {
        case 'compress':
          if (settings.colorMode === 'mono' || settings.colorMode === 'monochrome') { log('error', 'تحويل الأبيض والأسود غير مدعوم بعد؛ لم تُنفذ العملية.'); return null }
          command = settings.colorMode === 'grayscale' ? 'convert_pdf_to_grayscale' : 'compress_pdf'
          options = {
            level: settings.compressionLevel || 'balanced',
            dpi: settings.dpi || 150,
          }
          break
        case 'save':
          command = 'copy_pdf_file'
          break
        case 'export':
          if (params.format !== 'txt') { log('error', 'التصدير إلى هذه الصيغة يتطلب محرك تحويل إضافياً غير مضمن.'); return null }
          command = 'extract_pdf_text'
          outputExtension = 'txt'
          break
        case 'extract_text':
          command = 'extract_pdf_text'
          outputExtension = 'txt'
          break
        case 'organize_pages':
          command = 'split_pdf'
          if (Array.isArray(settings.targetPages) && settings.targetPages.length) {
            const pages = [...settings.targetPages].map(Number).sort((a, b) => a - b)
            if (pages.some((page, index) => index > 0 && page !== pages[index - 1] + 1)) { log('error', 'يقبل المحرك الحالي استخراج نطاق متصل فقط؛ لم تُنفذ العملية.'); return null }
            options = { startPage: pages[0] + 1, endPage: pages[pages.length - 1] + 1 }
          } else options = { startPage: settings.startPage, endPage: settings.endPage }
          break
        case 'merge_files':
          command = 'merge_pdfs'
          break
        case 'encrypt':
          command = 'encrypt_pdf'
          options = {
            userPass: settings.userPassword,
            ownerPass: settings.ownerPassword || settings.userPassword,
            allowPrint: settings.allowPrinting ?? false,
          }
          break
        case 'repair':
          command = 'repair_pdf'
          break
        case 'linearize':
          command = 'linearize_pdf'
          break
        case 'reorder_pages':
          command = 'reorder_pdf_pages'
          options = { pageOrder: settings.pageOrder }
          break
        default:
          log('error', 'هذه العملية غير متاحة في المحرك المحلي الحالي: ' + label)
          return null
      }

      if (operation === 'merge_files') {
        let mergeInputs = settings.secondaryFilePaths?.filter((path) => Boolean(path)) ?? []
        if (mergeInputs.length < 2) {
          const selected = await open({ multiple: true, directory: false, title: 'اختر ملفات PDF للدمج', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
          mergeInputs = Array.isArray(selected) ? selected : typeof selected === 'string' ? [selected] : []
        }
        if (mergeInputs.length < 2) return null
        inputPath = mergeInputs[0]
        options = { additionalInputPaths: mergeInputs.slice(1) }
      }

      const isText = outputExtension === 'txt'
      const requestedName = typeof params.filename === 'string' ? params.filename.replace(/[\\/]/g, '_') : ''
      const sourceDirectory = file.path.replace(/[^\\/]+$/, '')
      const defaultPath = requestedName ? sourceDirectory + requestedName : file.path.replace(/\.pdf$/i, '') + '_' + operation + '.' + outputExtension
      const outputPath = await save({
        title: 'احفظ الملف الناتج',
        defaultPath,
        filters: [{ name: isText ? 'Text' : 'PDF', extensions: [outputExtension] }],
      })
      if (!outputPath) return null

      setBusyOp(operation)
      setUploadProgress(0)
      setTimeRemaining('معالجة محلية بواسطة Ghostscript')
      log('info', 'بدء ' + label + ' محلياً.')

      const started = performance.now()
      try {
        const commandOptions = { ...params, ...options }
        if (operation === 'save') {
          await invoke(command, { inputPath: file.path, outputPath })
        } else if (operation === 'reorder_pages') {
          await invoke(command, { params: { inputPath, outputPath, pageOrder: settings.pageOrder } })
        } else {
          await invoke(command, { inputPath, outputPath, options: commandOptions })
        }

        const outputInfo = await invoke<{ sizeBytes: number; exists: boolean }>(
          'get_pdf_file_info',
          { params: { input_path: outputPath } },
        )
        if (!outputInfo.exists || (!isText && outputInfo.sizeBytes === 0)) {
          throw new Error('لم يُنشأ ملف ناتج صالح.')
        }

        const durationMs = Math.round(performance.now() - started)
        const entry: VaultEntry = {
          id: uid(),
          filename: fileName(outputPath),
          size: outputInfo.sizeBytes,
          operation,
          label,
          createdAt: Date.now(),
          url: outputPath,
          durationMs,
        }
        setVault((prev) => [entry, ...prev])
        setLastRun({ operation, durationMs, bytesIn: file.size, bytesOut: outputInfo.sizeBytes })
        setUploadProgress(100)
        setTimeRemaining('اكتملت المعالجة وحُفظ الملف')
        log('success', label + ' اكتملت. الملف محفوظ في ' + outputPath)
        try {
          const customMessage = (JSON.parse(localStorage.getItem('mocha-pro-admin-settings-v1') || '{}') as { startupMessage?: string }).startupMessage?.trim()
          if (customMessage) window.setTimeout(() => window.dispatchEvent(new CustomEvent('mocha-processing-notice', { detail: customMessage })), 5000)
        } catch { /* no saved startup message */ }
        return { kind: 'file', filename: entry.filename, path: outputPath, size: entry.size }
      } catch (error) {
        setUploadProgress(0)
        setTimeRemaining('فشلت المعالجة')
        log('error', error instanceof Error ? error.message : String(error))
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
      vault,
      removeFromVault,
      clearVault,
      logs,
      log,
      busyOp,
      uploadProgress,
      timeRemaining,
      lastRun,
      isReadyForProcessing: Boolean(file),
      run,
      openFilePicker,
    }),
    [file, info, inspecting, loadFile, clearFile, vault, removeFromVault, clearVault, logs, log, busyOp, uploadProgress, timeRemaining, lastRun, run, openFilePicker],
  )

  return <MochaContext.Provider value={value}>{children}</MochaContext.Provider>
}

export function useMocha() {
  const ctx = useContext(MochaContext)
  if (!ctx) throw new Error('useMocha must be used within MochaProvider')
  return ctx
}















