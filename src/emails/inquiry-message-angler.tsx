import { Heading, Text, Hr } from '@react-email/components'
import { EmailLayout, h1, text, textSmall, hr } from './_shared'

export interface InquiryMessageAnglerEmailProps {
  anglerName: string
  /** Used verbatim as the email subject line. */
  subject: string
  body: string
  tripTitle: string
  inquiryId: string
}

export function InquiryMessageAnglerEmail({
  anglerName,
  subject,
  body,
  tripTitle,
  inquiryId,
}: InquiryMessageAnglerEmailProps) {
  return (
    <EmailLayout preview={`${subject} — ${tripTitle}`}>
      <Heading style={h1}>{subject}</Heading>

      <Text style={text}>Hi {anglerName},</Text>

      {/* Message body — preserve line breaks */}
      <div style={messageBox}>
        {body.split('\n').map((line, i) => (
          <Text key={i} style={{ ...text, margin: line.trim() === '' ? '0 0 8px' : '0 0 14px' }}>
            {line || '\u00A0'}
          </Text>
        ))}
      </div>

      <Hr style={hr} />
      <Text style={textSmall}>
        This message is regarding your inquiry for <strong>{tripTitle}</strong>.
        Reference: {inquiryId}
      </Text>
      <Text style={textSmall}>
        Questions? Simply reply to this email and we&apos;ll get back to you promptly.
      </Text>
    </EmailLayout>
  )
}

const messageBox: React.CSSProperties = {
  backgroundColor: '#F8FAFB',
  border: '1px solid #E5E7EB',
  borderLeft: '3px solid #0A2E4D',
  borderRadius: '4px',
  padding: '20px 24px',
  margin: '0 0 24px',
}
