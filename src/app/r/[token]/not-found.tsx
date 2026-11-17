import { ExpiredNotice } from './ExpiredNotice'

export default function RequestNotFound() {
  return (
    <main className="min-h-screen px-4 flex items-center justify-center" style={{ background: '#F8FAFB' }}>
      <div className="w-full max-w-md">
        <ExpiredNotice />
      </div>
    </main>
  )
}
