import json,sys
for l in open(sys.argv[1]):
    d=json.loads(l)
    if 'case' not in d: print(d); continue
    print('\n==',d['variant'],f"{d['width']}x{d['height']}",d['case'])
    for k in ('pre','post','last','firstRadio','errorMessageVisibility'):
        if k not in d: continue
        x=d[k]; f=x['field']; a=x['activeElement']
        print(f" {k:8} {x['step']}: field={f['tag']}[{f['labelText'] or f['placeholder'] or f['ariaLabel']}] aria-invalid={f['ariaInvalid']} rect={x['visibility']['rect']['top']}..{x['visibility']['rect']['bottom']} clip={x['visibility']['visibleClip']['top']}..{x['visibility']['visibleClip']['bottom']} fullyVisible={x['visibility']['fullyVisibleInClip']} frac={x['visibility']['visibleFraction']} active={a['tag']}[{a['type'] or ''}|{a['labelText'] or a['placeholder'] or a['testid'] or a['ariaLabel'] or ''}] activeIsField={x['activeIsField']} scroll={x['scrollTop']}/{x['scrollMax']} pageY={x['pageScrollY']}")
    if 'errorText' in d: print('  errorText',d['errorText'])
