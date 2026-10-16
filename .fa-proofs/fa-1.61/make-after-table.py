import json,statistics
base='/home/tj/Fjordanglers/.fa-proofs/fa-1.61/'
def load(p): return [json.loads(l) for l in open(base+p) if l.startswith('{')]
before=load('timings-v1.jsonl')+load('timings-v2.jsonl')
after=load('client-timings-after.log')
proof=[r for r in load('after-work-proof.log')]
def st(v): return f"{min(v):.0f} / {statistics.median(v):.0f} / {max(v):.0f}"
def vals(rows,shape,label): return [r['client_ms'] for r in rows if r['shape']==shape and r['label']==label]
out=['# FA-1.61 phase A re-run on the NEW code (branch head 066d6a1: classify + autoSend in one `after()`; e-mails still before the response)\n',
'Client round trip of `POST /api/inquiries` (ms, min / median / max), measured from outside the route (no instrumentation). Same page, same bodies, same setup as `stage-timings-before.md` (local `next dev --turbo`, `RESEND_DEV_FAKE=1`, real Anthropic, `AI_AUTO_SEND_DAILY_CAP=1000`, warm-up discarded). Raw: `client-timings-after.log`.\n',
'| body | case | n | BEFORE (origin/main 2159df5) | AFTER (066d6a1) |','|---|---|---:|---|---|']
for shape in ('v1','v2'):
    for label,name in (('a-normal','(a) normal, AI on'),('b-trap','(b) trap'),('c-repeat','(c) repeat')):
        b=vals(before,shape,label); a=vals(after,shape,label)
        out.append(f"| {shape} | {name} | {len(a)} | {st(b)} | **{st(a)}** |")
out+=['\n## The AI work still happens, after the response (`after-work-proof.log`)\n','Local DB polled (SELECT only, ~100 ms granularity) until `agent.auto_send_decided` exists for the inquiry; ms counted from the moment the 201 arrived.\n','| body | run type | n | response ms (min/med/max) | `agent.auto_send_decided` landed, ms after the 201 (min/med/max) | all landed |','|---|---|---:|---|---|---|']
for shape in ('v1','v2'):
    for label in ('a-normal','c0-first-of-pair'):
        rs=[r for r in proof if r['shape']==shape and r['label']==label and 'landed' in r]
        if not rs: continue
        out.append(f"| {shape} | {label} | {len(rs)} | {st([r['response_ms'] for r in rs])} | {st([r['ms_after_response'] for r in rs if r['landed']])} | {all(r['landed'] for r in rs)} |")
out.append('\nFor (a) runs: `qualified_set` events and `messages` rows (draft saved): '+', '.join(f"{s}: messages={[r['messages'] for r in proof if r['shape']==s and r['label']=='a-normal']} qualified_set={[r['qualified_set_events'] for r in proof if r['shape']==s and r['label']=='a-normal']}" for s in ('v1','v2')))
out+=['\n(b)/(c): exactly one `agent.auto_send_decided` (sent=false, reason = trap / repeat), zero `inquiry.qualified_set`, zero `messages`, checked >= 15 s after the last request:\n','| body | case | n | decided=1 | qualified_set=0 | messages=0 | reasons |','|---|---|---:|---|---|---|---|']
for shape in ('v1','v2'):
    for label in ('b-trap','c-repeat'):
        rs=[r for r in proof if r['shape']==shape and r['label']==label]
        out.append(f"| {shape} | {label} | {len(rs)} | {all(r['decided_events']==1 for r in rs)} | {all(r['qualified_set_events']==0 for r in rs)} | {all(r['messages']==0 for r in rs)} | {sorted({r['reason'] for r in rs})} |")
open(base+'stage-timings-after.md','w').write('\n'.join(out)+'\n'); print('\n'.join(out))
