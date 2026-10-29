import { QRCodeSVG } from 'qrcode.react'
import { ExternalLink, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CONTACT_EMAILS, TELEGRAM_BOT_URL } from '@/lib/courses'
import { cn } from '@/lib/utils'

interface ContactCardProps {
  className?: string
  title?: string
  compact?: boolean
  qrSize?: number
}

export function ContactCard({
  className,
  title = 'Contáctanos',
  compact = false,
  qrSize = 148,
}: ContactCardProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-[var(--line)] bg-white',
        compact ? 'p-4' : 'p-5 sm:p-6',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-5',
          compact ? 'sm:flex-row sm:items-center' : 'sm:flex-row sm:items-start',
        )}
      >
        <div className="mx-auto shrink-0 rounded-lg border border-[var(--line)] bg-white p-3">
          <QRCodeSVG
            value={TELEGRAM_BOT_URL}
            size={qrSize}
            level="M"
            marginSize={1}
            bgColor="#ffffff"
            fgColor="#012e5a"
            title="Código QR del bot de Telegram CTT-FISEI"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h3 className="text-base font-semibold text-[var(--navy)] sm:text-lg">
              {title}
            </h3>
            <p className="mt-1 text-sm text-[var(--text)]">
              Escríbenos por Telegram
            </p>
          </div>

          <Button
            asChild
            className="h-10 rounded-md bg-[var(--red)] font-semibold text-white hover:bg-[var(--crimson)]"
          >
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
              <Send className="size-4" />
              Abrir chat
              <ExternalLink className="size-3.5 opacity-70" />
            </a>
          </Button>

          <ul className="space-y-1.5 pt-1">
            {CONTACT_EMAILS.map((email) => (
              <li key={email}>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 text-sm text-[var(--text)] transition-ui hover:text-[var(--navy)]"
                >
                  <Mail className="size-3.5 shrink-0" />
                  <span className="break-all">{email}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
