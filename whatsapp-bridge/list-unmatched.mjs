import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
})

const { data } = await sb
  .from('unmatched_messages')
  .select('from_identifier, sender_name, created_at')
  .eq('source', 'whatsapp')
  .order('from_identifier')

const grouped = {}
for (const r of data ?? []) {
  if (!grouped[r.from_identifier]) grouped[r.from_identifier] = { name: r.sender_name, count: 0 }
  grouped[r.from_identifier].count++
}

for (const [phone, v] of Object.entries(grouped))
  console.log(`+${phone}  ${v.name}  (${v.count} messages)`)

process.exit(0)
