'use client'

import React from 'react'

export default function CoachDrawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel: full-screen on mobile, side drawer on md+ */}
      <div className="absolute inset-x-0 bottom-0 top-auto h-full md:inset-auto md:right-0 md:top-0 md:h-full md:w-full md:max-w-md">
        <div className="h-full w-full bg-white shadow-xl flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between sticky top-0 bg-white">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none" aria-label="Close">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

