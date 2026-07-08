/**
 * Inquiry agent follow-up email.
 *
 * Minimal, conversational tone — no buttons, no marketing.
 * Sent by the AI agent when it needs one more detail from the angler.
 */

import { Text } from '@react-email/components'
import { EmailLayout, text, textSmall } from './_shared'

export interface InquiryAgentEmailProps {
  anglerName: string
  question:   string   // single AI-generated question
  tripTitle:  string
  inquiryId:  string
}

export function InquiryAgentEmail({
  anglerName,
  question,
  tripTitle,
}: InquiryAgentEmailProps) {
  return (
    <EmailLayout preview={question}>
      <Text style={text}>Hi {anglerName},</Text>
      <Text style={text}>{question}</Text>
      <Text style={text}>Best,{'\n'}FjordAnglers team</Text>
      <Text style={textSmall}>Re: {tripTitle}</Text>
    </EmailLayout>
  )
}

export default InquiryAgentEmail
