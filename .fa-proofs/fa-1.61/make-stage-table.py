import json,statistics,sys
base='/home/tj/Fjordanglers/.fa-proofs/fa-1.61/'
srv={}
for l in open(base+'stage-timings-raw.log'):
    d=json.loads(l.split('[fa161-timing] ',1)[1]); srv[d['id']]=d
rows=[]
for shape in ('v1','v2'):
    for l in open(base+f'timings-{shape}.jsonl'):
        r=json.loads(l); r['srv']=srv.get(r['id']); rows.append(r)
stages=['validation_lookup','brief_guide_lookup','insert','repeat_lookup_skip_event','emails','classify','autosend','total']
names={'validation_lookup':'validation + page lookup','brief_guide_lookup':'(v2) primary-guide lookup','insert':'createInquiry insert','repeat_lookup_skip_event':'repeat lookup + skip event','emails':'2 e-mails (Promise.all, faked)','classify':'classifyInquiry','autosend':'autoSendReply','total':'TOTAL in handler','client':'client round trip'}
def f(v): return '–' if v is None else f'{v:.0f}' if v>=100 else f'{v:.1f}'
out=['# FA-1.61 phase A — POST /api/inquiries, stage timings BEFORE (origin/main 2159df5 + temporary timing lines)\n',
'All numbers in ms. Local `next dev --turbo` (Next 16.1.6), local Supabase (4 containers), real Anthropic calls, **e-mail faked** (`RESEND_DEV_FAKE=1`: no template render, no Resend HTTP call — so the e-mail stage is a lower bound, see caveats). First request of each shape is a discarded warm-up (compilation). `AI_AUTO_SEND_DAILY_CAP=1000` in the dev process so the daily cap (default 5) does not short-circuit the send. Rate limiter fails open (no Upstash config).\n']
for shape in ('v1','v2'):
    out.append(f'\n## {shape.upper()} body shape ({"experience_page_id, requested_dates/trip_length, no brief" if shape=="v1" else "experience_page_id + brief + angler_country"}) — page seed-backcountry-day-nz\n')
    for label,title in (('a-normal','(a) normal inquiry, AI enabled'),('b-trap','(b) trap field filled (`trip_notes_extra: "x"`)'),('c-repeat','(c) repeat (same e-mail as an inquiry from seconds earlier)')):
        rs=[r for r in rows if r['shape']==shape and r['label']==label]
        out.append(f'\n### {title} — n={len(rs)}\n')
        out.append('| stage | min | median | max |\n|---|---:|---:|---:|')
        for s in stages+['client']:
            if s=='client': vals=[r['client_ms'] for r in rs]
            else: vals=[r['srv'][s] for r in rs if r['srv'] and r['srv'][s] is not None]
            if not vals: continue
            if s=='brief_guide_lookup' and shape=='v1': continue
            out.append(f'| {names[s]} | {f(min(vals))} | {f(statistics.median(vals))} | {f(max(vals))} |')
        out.append('\nflags seen: '+', '.join(sorted({f"suspicious={r['srv']['suspicious']} repeat={r['srv']['repeat']} ai={r['srv']['ai']}" for r in rs})))
open(base+'stage-timings-before.md','w').write('\n'.join(out)+'\n')
print('\n'.join(out))
