'use client'

import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { useMocha } from './mocha-provider'

export function GlassPanel({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/[0.08] bg-slate-deep/60 backdrop-blur-xl',
        'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function TiltCard({ className, children, ...props }: React.ComponentProps<'div'>) {
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`)
  }
  function onLeave(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }
  return (
    <div className="[perspective:900px]">
      <div
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className={cn(
          'group/tilt relative h-full rounded-2xl border border-white/[0.08] bg-slate-deep/70 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-200 ease-out',
          'hover:border-gold/40 hover:shadow-[0_20px_50px_-20px_rgb(217_119_6/0.45)] motion-reduce:transform-none',
          '[transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] [transform-style:preserve-3d]',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover/tilt:opacity-100"
          style={{ background: 'radial-gradient(240px circle at var(--gx,50%) var(--gy,50%), rgb(217 119 6 / 0.14), transparent 70%)' }}
        />
        {children}
      </div>
    </div>
  )
}

export function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neon/30 bg-neon/10 text-neon">
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function ActionButton({
  op,
  icon: Icon,
  children,
  variant = 'primary',
  className,
  disabled,
  ...props
}: React.ComponentProps<'button'> & {
  op?: string
  icon?: LucideIcon
  variant?: 'primary' | 'ghost' | 'signal' | 'danger'
}) {
  const { busyOp } = useMocha()
  const busy = op !== undefined && busyOp === op
  const variants = {
    primary: 'bg-neon text-white hover:bg-[#7476f3] shadow-neon',
    signal: 'bg-signal text-black hover:bg-[#2fca96] shadow-[0_0_24px_-6px_rgb(16_185_129/0.8)]',
    ghost: 'border border-white/10 bg-white/[0.03] text-white hover:border-neon/50 hover:bg-neon/10',
    danger: 'border border-destructive/40 bg-destructive/10 text-red-300 hover:bg-destructive/20',
  }
  return (
    <button
      type="button"
      disabled={disabled || busy || (op !== undefined && busyOp !== null)}
      aria-busy={busy}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-all',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {busy ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="size-4" aria-hidden />
      )}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-white/80">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const inputClass = cn(
  'h-10 w-full rounded-lg border border-white/10 bg-black/60 px-3 text-sm text-white placeholder:text-white/30',
  'transition-colors focus:border-neon/70 focus:outline-none focus:ring-2 focus:ring-neon/25',
)

export function TextInput({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function SelectInput({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select className={cn(inputClass, 'cursor-pointer appearance-none', className)} {...props}>
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-black/40 p-3">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-white">
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon',
          checked ? 'border-signal/60 bg-signal/30' : 'border-white/15 bg-white/5',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-[18px] rounded-full transition-all',
            checked ? 'start-[22px] bg-signal shadow-signal' : 'start-0.5 bg-white/50',
          )}
        />
      </button>
    </div>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-lg border border-white/10 bg-black/50 p-1">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              active ? 'bg-neon text-white shadow-neon' : 'text-white/60 hover:bg-white/5 hover:text-white',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Checkbox({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center gap-2.5 text-sm text-white/85', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-white/20 bg-black accent-neon disabled:cursor-not-allowed" />
      {label}
    </label>
  )
}


