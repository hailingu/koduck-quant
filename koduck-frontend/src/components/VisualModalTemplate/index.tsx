import type { ReactNode } from 'react'

interface VisualModalTemplateProps {
  readonly open: boolean
  readonly title: string
  readonly description?: ReactNode
  readonly icon?: ReactNode
  readonly onClose: () => void
  readonly closeAriaLabel: string
  readonly accent?: 'primary' | 'secondary'
  readonly maxWidthClassName?: string
  readonly children?: ReactNode
  readonly actions?: ReactNode
}

export default function VisualModalTemplate({
  open,
  title,
  description,
  icon,
  onClose,
  closeAriaLabel,
  accent = 'primary',
  maxWidthClassName = 'max-w-md',
  children,
  actions,
}: Readonly<VisualModalTemplateProps>) {
  if (!open) {
    return null
  }

  const accentLineClass =
    accent === 'secondary'
      ? 'via-fluid-secondary/60'
      : 'via-fluid-primary/60'

  const cardBorderClass =
    accent === 'secondary'
      ? 'border-fluid-secondary/30'
      : 'border-fluid-primary/20'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={closeAriaLabel}
      />

      <div
        className={`relative z-10 w-full ${maxWidthClassName} overflow-hidden rounded-lg border bg-fluid-surface-container-low shadow-[0_0_40px_rgba(0,242,255,0.1)] ${cardBorderClass}`}
      >
        <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent to-transparent ${accentLineClass}`} />

        <div className="p-8">
          <div className="flex flex-col items-center text-center">
            {icon && (
              <div
                className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border ${
                  accent === 'secondary'
                    ? 'border-fluid-secondary/20 bg-fluid-secondary/10 text-fluid-secondary'
                    : 'border-fluid-primary/20 bg-fluid-primary/10 text-fluid-primary'
                }`}
              >
                {icon}
              </div>
            )}

            <h2 className="mb-3 font-headline text-2xl font-bold tracking-tight text-fluid-text">{title}</h2>
            {description ? (
              <p className="text-sm leading-relaxed text-fluid-text-dim">{description}</p>
            ) : null}
          </div>

          {children ? <div className="mt-6">{children}</div> : null}
          {actions ? <div className="mt-6 grid grid-cols-2 gap-4">{actions}</div> : null}
        </div>

        <div className="absolute bottom-1 right-1 h-2 w-2 border-b border-r border-fluid-outline/30" />
      </div>
    </div>
  )
}
