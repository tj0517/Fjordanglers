import Image from 'next/image'

export type FishVariant = 'salmon' | 'pike' | 'perch'

export interface SpeciesInfo {
  variant: FishVariant
  tagline: string
  desc: string
  trophy: string
  bg: string
  accent: string
  photo?: string
}

interface Props {
  fish: string
  info: SpeciesInfo | undefined
  compact?: boolean
}

export function SpeciesCard({ fish, info, compact = false }: Props) {
  const accent = info?.accent ?? '#E67E50'

  return (
    <div
      className="flex items-center gap-3 rounded-2xl"
      style={{
        background: info?.bg ?? 'rgba(230,126,80,0.08)',
        border: `1px solid ${accent}28`,
        padding: compact ? '10px 12px' : '12px 16px',
      }}
    >
      {/* Photo thumbnail */}
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden"
        style={{ width: compact ? 56 : 72, height: compact ? 32 : 40 }}
      >
        {info?.photo != null ? (
          <Image
            src={info.photo}
            alt={fish}
            width={compact ? 56 : 72}
            height={compact ? 32 : 40}
            className="object-contain w-full h-full"
          />
        ) : (
          <div className="w-full h-full" style={{ background: `${accent}20` }} />
        )}
      </div>

      <h3
        className="font-semibold f-body"
        style={{ color: '#0A2E4D', fontSize: compact ? '13px' : '14px' }}
      >
        {fish}
      </h3>
    </div>
  )
}
