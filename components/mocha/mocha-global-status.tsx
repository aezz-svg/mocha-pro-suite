'use client'

import { useMocha } from '@/components/mocha/mocha-provider'

export function MochaGlobalStatus() {
  const { busyOp, uploadProgress, timeRemaining, lastRun } = useMocha()

  // إذا لم تكن هناك عملية جارية ولم ينتهي التشغيل للتو، لا نقوم بالعرض
  if (!busyOp && !uploadProgress) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white space-y-3 animate-fade-in">
      {/* الحالة الأولى: عملية الرفع والاستدعاء السحابي */}
      <div className="flex justify-between items-center text-sm font-semibold">
        <span className="text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          {busyOp ? `جاري معالجة: ${busyOp}` : 'اكتملت العملية'}
        </span>
        <span className="text-emerald-400 font-mono font-bold">{uploadProgress}%</span>
      </div>

      {/* شريط التقدم المرئي (Progress Bar) */}
      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full transition-all duration-300 ease-out"
          style={{ width: `${uploadProgress}%` }}
        />
      </div>

      {/* الحالة الثانية والثالثة: الوقت التقديري للمعالجة وجهوزية التحميل */}
      <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-800">
        <span>{timeRemaining}</span>
        {lastRun && (
          <span className="text-emerald-400 font-mono">
            {Math.round(lastRun.durationMs)}ms ⚡
          </span>
        )}
      </div>
    </div>
  )
}