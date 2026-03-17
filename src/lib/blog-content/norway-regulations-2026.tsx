import Image from 'next/image'

export const NORWAY_SECTIONS = [
  { id: 'sea-angling',        label: 'Sea Angling' },
  { id: 'freshwater-fishing', label: 'Freshwater Fishing' },
  { id: 'salmon-rivers',      label: 'Salmon Rivers' },
  { id: 'exporting-fish',     label: 'Exporting Caught Fish' },
  { id: 'comparison',         label: 'Quick Comparison' },
  { id: 'faq',                label: 'FAQ' },
  { id: 'useful-links',       label: 'Useful Links' },
] as const

// ─── Main article component ───────────────────────────────────────────────────

export function NorwayRegulationsContent() {
  return (
    <article>

      {/* Intro lead */}
      <LeadParagraph>
        Norway is an absolute paradise for anglers. From deep fjords and wild lakes to rushing rivers
        full of powerful salmon – the possibilities are endless. However, Norwegian law is very strict
        when it comes to nature conservation. Before you cast your line, you need to know the current{' '}
        <strong>fishing regulations in Norway applicable in 2026</strong>.
      </LeadParagraph>
      <P>
        In this article, you will find everything you need to know before your trip: from information
        about licenses (<em>fiskekort</em>, <em>fiskeravgift</em>), through export limits, to mandatory equipment
        disinfection.
      </P>

      <Spacer />

      {/* ── SECTION 1 ────────────────────────────────────── */}
      <SectionLabel>Part 1</SectionLabel>
      <H2 id="sea-angling">Sea Angling in Norway – Free, but with Rules</H2>
      <P>
        Fishing in Norwegian fjords and the open sea is the most popular activity among tourists.
        Most importantly – it is very accessible.
      </P>

      <H3>Do you need a license for the sea?</H3>
      <P>
        No. <strong>A license is not required</strong> for recreational sea angling from the shore or a boat.
        However, you must remember that fishing must be done exclusively using recreational
        methods (rod, spinning, fly fishing).
      </P>

      <H3>Minimum sizes and angler&apos;s duties</H3>
      <P>
        No license does not mean no rules. Norway has strict <strong>minimum size limits</strong> for specific fish
        species (e.g., cod, halibut, or saithe).
      </P>
      <Ul items={[
        'Fish below the minimum size must be carefully and immediately released back into the water.',
        'You must strictly comply with local seasonal restrictions and fishing bans specified for a given species.',
      ]} />

      <H3>Where can you fish from the shore and boat?</H3>
      <P>
        Fishing is permitted on most of the coastline. The exceptions where <strong>fishing is prohibited</strong> include:
      </P>
      <Ul items={[
        'Military areas',
        'Commercial ports',
        'Private piers (without explicit permission from the owner)',
        'Marine nature reserves',
      ]} />
      <InfoNote>
        You must also keep a safe distance from fish farms, according to local markings on the water.
      </InfoNote>

      {/* Photo break — sea fish */}
      <PhotoBlock
        src="/fish_catalog/cod.png"
        alt="Atlantic cod"
        caption="Cod, halibut, and saithe are among the saltwater species with strict minimum size requirements."
      />

      <Spacer />

      {/* ── SECTION 2 ────────────────────────────────────── */}
      <SectionLabel>Part 2</SectionLabel>
      <H2 id="freshwater-fishing">Freshwater Fishing – Lakes and Rivers</H2>
      <P>
        If you prefer peaceful fishing for trout, pike, or perch in lakes, you need to prepare for
        different rules than at sea. Here, the water always has an owner or manager.
      </P>

      <H3>The Fiskekort License – Your entry ticket</H3>
      <P>
        <strong>Fiskekort</strong> (a local fishing license) is mandatory on most freshwater bodies. Remember that
        this license is not universal – it is assigned to a specific body of water or even a specific
        stretch of a river.
      </P>
      <P>
        You can conveniently buy it online (e.g., via the Inatur portal) or locally from vendors (often at
        gas stations or fishing tackle shops).
      </P>

      <H3>Local regulations</H3>
      <P>
        Water owners have the right to set their own rules. Always check the following before you
        start fishing:
      </P>
      <Ul items={[
        'Minimum size limits',
        'Daily bag limits',
        'Conservation periods for specific species',
        'Any bans (e.g., using live bait or combustion engines on boats)',
      ]} />
      <P>
        During an inspection by the fishing guard, you must present your <strong>fiskekort</strong> (in paper form or
        electronically on your phone) and a piece of ID.
      </P>

      {/* Photo break — freshwater */}
      <PhotoBlock
        src="/fish_catalog/trout.png"
        alt="Brown trout"
        caption="Trout, pike, and perch are popular freshwater targets — each with their own licensing requirements."
      />

      <Spacer />

      {/* ── SECTION 3 ────────────────────────────────────── */}
      <SectionLabel>Part 3</SectionLabel>
      <H2 id="salmon-rivers">Salmon Rivers – The Kingdom of Salmon and Sea Trout</H2>
      <P>
        Fishing for salmon and sea trout (<em>sjørøye</em>) in rivers is the most prestigious, but also the most
        heavily regulated category of fishing in Norway.
      </P>

      <H3>Fiskeravgift (National fee)</H3>
      <P>
        To even consider legally fishing for anadromous (migratory) fish in rivers, adults must first
        pay the <strong>fiskeravgift</strong>, which is an annual national state fee. You must always have proof of
        payment with you by the water.
      </P>

      <H3>Local Fiskekort for the river</H3>
      <P>
        The national fee itself is not enough. In addition to it, you must purchase a local <strong>fiskekort</strong> for
        a specific river or its designated section (so-called <em>beat</em>). Due to high demand, licenses for
        the best rivers need to be booked well in advance.
      </P>

      <H3>Mandatory equipment disinfection</H3>
      <P>
        This is a crucial point that many tourists forget! Norwegian rivers are protected against the{' '}
        <em>Gyrodactylus salaris</em> parasite, which is deadly to salmon.
      </P>
      <Ul items={[
        'Your equipment (rods, lines, landing nets, waders) must be disinfected before entering the water.',
        'Disinfection is carried out at authorized points along the rivers (often at campsites or gas stations).',
        'After the procedure, you will receive a disinfection certificate, which is checked during inspections.',
      ]} />

      <WarningCard>
        Every salmon river has its own very strict regulations — mandatory use of barbless hooks,
        mandatory release of female fish during specific periods. Always check before your first cast.
      </WarningCard>

      {/* Photo break — salmon */}
      <PhotoBlock
        src="/fish_catalog/salmon.png"
        alt="Atlantic salmon"
        caption="Atlantic salmon – Norway's most regulated and most coveted catch."
      />

      <Spacer />

      {/* ── SECTION 4 ────────────────────────────────────── */}
      <SectionLabel>Part 4</SectionLabel>
      <H2 id="exporting-fish">Exporting Caught Fish from Norway in 2026</H2>
      <P>
        The rules for taking fish out of Norway are very strict and regularly checked by customs
        officials at borders (including ferries).
      </P>
      <P>
        In 2026, to export fish fillets from Norway, you must meet two conditions:
      </P>
      <ol style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[
          <>Stay within the <strong>tourist weight limit</strong> (limits are updated by the Norwegian Customs authorities – check them before your trip).</>,
          <>Have documented proof of origin. This means that you can only export fish if you fished at a <strong>registered tourist fishing camp</strong>.</>,
        ].map((item, i) => (
          <li key={i} style={{ fontSize: '16px', lineHeight: 1.8, color: 'rgba(10,46,77,0.65)', paddingLeft: '0.25rem' }}>
            {item}
          </li>
        ))}
      </ol>
      <P>
        During a customs check, you must present an official document issued by the camp,
        confirming your catch. Exporting fish caught on your own, outside of registered fishing
        bases, is illegal.
      </P>

      {/* Export limit stat callout */}
      <StatCallout
        value="15 kg"
        label="marine fish per person"
        note="Maximum twice per calendar year. Dropping to 10 kg from January 1, 2027."
      />

      <Spacer />

      {/* ── COMPARISON TABLE ─────────────────────────────── */}
      <H2 id="comparison">Quick Comparison: Which Rules Apply to You?</H2>

      <BreakoutTable>
        <thead>
          <tr style={{ background: '#0A2E4D' }}>
            {['Type of Fishing', 'License required?', 'Where can you fish?', 'Key Responsibilities'].map(h => (
              <th key={h} style={{
                padding: '14px 20px', textAlign: 'left', color: '#fff',
                fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            {
              type: 'Sea', badge: '#1B4F72',
              license: 'No',
              where: 'Coastline, fjords (outside protected zones, ports, and military areas).',
              resp: 'Knowing minimum sizes; having a document from a registered camp for export.',
            },
            {
              type: 'Freshwater', badge: '#2E6B4A',
              license: 'Yes — fiskekort',
              where: 'Lakes and rivers for which you hold a license.',
              resp: 'Having a license (fiskekort) and ID; obeying local regulations.',
            },
            {
              type: 'Salmon', badge: '#7B3F1A',
              license: 'Yes — National fiskeravgift + local fiskekort',
              where: 'Only designated river sections with a purchased license.',
              resp: 'Having the national fee, local license, disinfection certificate; strictly obeying river regulations.',
            },
          ].map((row, i) => (
            <tr key={row.type} style={{ background: i % 2 === 0 ? '#FDFAF7' : 'rgba(243,237,228,0.6)', verticalAlign: 'top' }}>
              <td style={{ ...tdStyle, paddingTop: '16px', paddingBottom: '16px' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
                  background: row.badge, color: '#fff', fontSize: '12px', fontWeight: 600,
                }}>
                  {row.type}
                </span>
              </td>
              <td style={tdStyle}>{row.license}</td>
              <td style={tdStyle}>{row.where}</td>
              <td style={tdStyle}>{row.resp}</td>
            </tr>
          ))}
        </tbody>
      </BreakoutTable>

      <Spacer />

      {/* ── FAQ ──────────────────────────────────────────── */}
      <H2 id="faq">FAQ – Frequently Asked Questions (2026)</H2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          {
            q: 'Exactly how many kilograms of fish can I export from Norway in 2026?',
            a: <>In 2026, the tourist limit is exactly <strong>15 kg</strong> of marine fish or processed products (e.g., fillets) per person. You can use this limit a maximum of twice per calendar year. Remember that the condition for export is staying at a registered tourist fishing camp and having a personalized certificate issued by them. <em>Important note:</em> From January 1, 2027, this limit will become stricter and drop to 10 kg!</>,
          },
          {
            q: 'Do fish from lakes and rivers count towards the export limit?',
            a: <>No. Freshwater and anadromous species (e.g., salmon, trout, Arctic char, pike) are completely excluded from the 15 kg marine limit. You also do not need to catch them at a registered camp, but in the event of a customs inspection, you must show proof of a legal catch (e.g., a paid <em>fiskekort</em> for a given lake or river).</>,
          },
          {
            q: 'How far from fish farms am I allowed to fish?',
            a: <>Norwegian law sets strict boundaries. When fishing, you must keep an absolute minimum distance of <strong>100 meters</strong> from the nearest fish farm. If you are not fishing and merely passing by in a boat, you must maintain a distance of at least 20 meters from the cages and mooring elements.</>,
          },
          {
            q: 'Are there any fish species I am not allowed to catch or keep?',
            a: (
              <>
                <p style={{ marginBottom: '0.75rem' }}>Yes, Norway has exceptions to protect specific populations:</p>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <li style={liStyle}><strong>Cod in the Oslofjord:</strong> There is a total, year-round ban on catching cod in this area due to stock depletion.</li>
                  <li style={liStyle}><strong>Halibut:</strong> Any specimen measuring <strong>over 2 meters</strong> in length must be strictly and carefully released back into the water unharmed.</li>
                  <li style={liStyle}><strong>King crab and bluefin tuna:</strong> Tourists are not allowed to catch them on their own (you can only go for crabs as part of organized tours with set quotas in the Finnmark province). Tourists are strictly prohibited from selling any recreationally caught fish.</li>
                </ul>
              </>
            ),
          },
          {
            q: 'I only fish from the shore in the sea. Do I need to disinfect my equipment?',
            a: <>No. The requirement to disinfect equipment, clothing, and waders (most often with a Virkon S solution) applies exclusively to fishing in fresh waters – rivers and lakes. This is to protect against the transmission of infectious diseases and parasites, such as <em>Gyrodactylus salaris</em>.</>,
          },
          {
            q: 'Where and how can I buy a lake fishing license (fiskekort)?',
            a: <>The easiest way is to do it online through the Inatur portal (inatur.no), which gathers most Norwegian fisheries. You can also buy paper licenses locally – at nearby grocery stores, fishing tackle shops, campsites, or gas stations.</>,
          },
        ].map(({ q, a }, i, arr) => (
          <div key={q} style={{
            padding: '1.75rem 0',
            borderBottom: i < arr.length - 1 ? '1px solid rgba(10,46,77,0.08)' : 'none',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '0.6rem',
          }}>
            <p style={{ fontWeight: 700, color: '#0A2E4D', fontSize: '16px', lineHeight: 1.45 }}>{q}</p>
            <div style={{ fontSize: '15px', lineHeight: 1.8, color: 'rgba(10,46,77,0.62)' }}>{a}</div>
          </div>
        ))}
      </div>

      <Spacer />

      {/* ── USEFUL LINKS ─────────────────────────────────── */}
      <H2 id="useful-links">Useful Links (Official Resources)</H2>
      <P style={{ marginBottom: '2rem' }}>
        All the links below lead to official, verified websites of Norwegian state institutions:
      </P>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        {[
          {
            title: 'Sea Angling & Minimum Sizes',
            icon: '🌊',
            links: [
              { label: 'Directorate of Fisheries – Sea angling rules', href: 'https://www.fiskeridir.no/english/sea-angling-in-norway' },
              { label: 'Minimum sizes for saltwater species', href: 'https://www.fiskeridir.no/English/Fishing-in-Norway/Minimum-sizes' },
              { label: 'Interactive map of zones & protected areas', href: 'https://kart.fiskeridir.no' },
            ],
          },
          {
            title: 'Licenses & Freshwater',
            icon: '🎣',
            links: [
              { label: 'Inatur – Buy Fiskekort online', href: 'https://inatur.no/fiske' },
              { label: 'National fee (Fiskeravgift)', href: 'https://fiskeravgift.miljodirektoratet.no' },
              { label: 'Salmon river register & regulations', href: 'https://www.miljodirektoratet.no/lakseregisteret' },
            ],
          },
          {
            title: 'Export & Health',
            icon: '📋',
            links: [
              { label: 'Norwegian Customs – Fish export rules', href: 'https://www.toll.no/en/goods/fish/quota' },
              { label: 'Veterinary Institute – Gyrodactylus salaris', href: 'https://www.vetinst.no/sykdom-og-agens/gyrodactylus-salaris' },
              { label: 'Food Safety Authority (Mattilsynet)', href: 'https://www.mattilsynet.no' },
            ],
          },
        ].map(group => (
          <div key={group.title} style={{
            background: '#FDFAF7',
            border: '1px solid rgba(10,46,77,0.08)',
            borderRadius: '16px',
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '18px' }}>{group.icon}</span>
              <p style={{ fontWeight: 700, fontSize: '13px', color: '#0A2E4D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {group.title}
              </p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {group.links.map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '13px', color: '#1B4F72', textDecoration: 'underline', textUnderlineOffset: '3px', lineHeight: 1.5 }}
                  >
                    {link.label} →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

    </article>
  )
}

// ─── Layout primitives ────────────────────────────────────────────────────────

const liStyle: React.CSSProperties = {
  fontSize: '15px', lineHeight: 1.8, color: 'rgba(10,46,77,0.65)',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 20px', fontSize: '14px', lineHeight: 1.65,
  color: 'rgba(10,46,77,0.68)', verticalAlign: 'top',
  borderBottom: '1px solid rgba(10,46,77,0.07)',
}

function LeadParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '20px', lineHeight: 1.75, color: '#0A2E4D', marginBottom: '1.5rem', fontWeight: 400 }}>
      {children}
    </p>
  )
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: '16px', lineHeight: 1.85, color: 'rgba(10,46,77,0.65)', marginBottom: '1.25rem', ...style }}>
      {children}
    </p>
  )
}

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{
      fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: '#0A2E4D',
      lineHeight: 1.2, marginBottom: '1.25rem', marginTop: '0.25rem',
      scrollMarginTop: '6rem',
    }}>
      {children}
    </h2>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '17px', fontWeight: 700, color: '#0A2E4D',
      lineHeight: 1.35, marginBottom: '0.75rem', marginTop: '2rem',
    }}>
      {children}
    </h3>
  )
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {items.map(item => (
        <li key={item} style={{ ...liStyle, listStyleType: 'disc' }}>{item}</li>
      ))}
    </ul>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
      <div style={{ width: '24px', height: '1.5px', background: '#E67E50' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#E67E50', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
        {children}
      </span>
    </div>
  )
}

function Spacer() {
  return <div style={{ height: '3.5rem' }} />
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(27,79,114,0.06)',
      border: '1px solid rgba(27,79,114,0.15)',
      borderLeft: '3px solid #1B4F72',
      borderRadius: '0 10px 10px 0',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(10,46,77,0.7)', fontStyle: 'italic', margin: 0 }}>
        <strong style={{ fontStyle: 'normal', color: '#1B4F72' }}>Note: </strong>{children}
      </p>
    </div>
  )
}

function WarningCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(230,126,80,0.08)',
      border: '1px solid rgba(230,126,80,0.25)',
      borderLeft: '3px solid #E67E50',
      borderRadius: '0 10px 10px 0',
      padding: '1.25rem 1.5rem',
      marginBottom: '2rem',
      marginTop: '1rem',
    }}>
      <p style={{ fontSize: '14px', lineHeight: 1.75, color: 'rgba(10,46,77,0.7)', margin: 0 }}>
        <strong style={{ color: '#E67E50' }}>Important: </strong>{children}
      </p>
    </div>
  )
}

function StatCallout({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div style={{
      background: '#0A2E4D',
      borderRadius: '16px',
      padding: '2rem 2.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      marginTop: '0.5rem',
      marginBottom: '2rem',
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 'clamp(40px, 6vw, 56px)', fontWeight: 800, color: '#E67E50', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{label}</div>
      </div>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <p style={{ fontSize: '14px', lineHeight: 1.75, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
          {note}
        </p>
      </div>
    </div>
  )
}

function PhotoBlock({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <div style={{ margin: '2.5rem -2rem' }}>
      <div style={{
        position: 'relative',
        height: 'clamp(220px, 35vw, 400px)',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#0A2E4D',
      }}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          style={{ opacity: 0.85 }}
        />
      </div>
      {caption && (
        <p style={{
          fontSize: '12px',
          color: 'rgba(10,46,77,0.4)',
          textAlign: 'center',
          marginTop: '0.75rem',
          fontStyle: 'italic',
          lineHeight: 1.6,
          padding: '0 1rem',
        }}>
          {caption}
        </p>
      )}
    </div>
  )
}

function BreakoutTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 -2rem 2.5rem', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '16px', overflow: 'hidden', fontSize: '14px' }}>
        {children}
      </table>
    </div>
  )
}
