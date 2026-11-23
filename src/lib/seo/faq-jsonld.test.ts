import { describe, it, expect } from 'vitest'
import { buildFaqPageJsonLd } from './faq-jsonld'

describe('buildFaqPageJsonLd', () => {
  it('one Question per entry, the answer as plain text', () => {
    expect(buildFaqPageJsonLd([{ question: 'Q1?', answer: 'A1.' }, { question: 'Q2?', answer: 'A2.\nSecond line.' }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Q1?', acceptedAnswer: { '@type': 'Answer', text: 'A1.' } },
        { '@type': 'Question', name: 'Q2?', acceptedAnswer: { '@type': 'Answer', text: 'A2.\nSecond line.' } },
      ],
    })
  })

  it('no entries, no FAQPage — an empty one is invalid markup', () => {
    expect(buildFaqPageJsonLd([])).toBeNull()
  })
})
