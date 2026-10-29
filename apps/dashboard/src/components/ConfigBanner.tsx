interface ConfigBannerProps {
  missing: string[]
}

export function ConfigBanner({ missing }: ConfigBannerProps) {
  if (missing.length === 0) return null

  return (
    <div className="banner-enter border-b border-amber-200/80 bg-amber-50/95 px-4 py-2 text-sm text-amber-900 backdrop-blur-sm">
      <p className="font-medium tracking-tight">Faltan variables de entorno</p>
      <p className="text-xs text-amber-800">
        Configura {missing.join(', ')} en <code className="rounded bg-amber-100 px-1">apps/dashboard/.env</code>{' '}
        (o activa <code className="rounded bg-amber-100 px-1">VITE_USE_MOCKS=true</code> para demo local).
      </p>
    </div>
  )
}
