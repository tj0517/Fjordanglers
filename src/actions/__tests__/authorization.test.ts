/**
 * Authorization tests for server actions.
 *
 * These are pure unit tests — no network, no external services.
 * We mock @/lib/supabase/server, @/lib/stripe/client, @/lib/env,
 * @/lib/email and other side-effectful modules so no real I/O happens.
 *
 * Each test verifies that calling an action without the correct session
 * throws UnauthorizedError BEFORE any service-role write.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock all modules with external dependencies BEFORE importing anything else.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    accounts: { retrieve: vi.fn() },
  },
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://test.example.com',
    ANTHROPIC_API_KEY: 'sk-test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    STRIPE_SECRET_KEY: 'sk_test_1234',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    RESEND_API_KEY: 'test-resend',
    RESEND_INBOUND_SECRET: 'test-secret',
  },
}))

vi.mock('@/lib/email', () => ({
  sendDepositLinkAnglerEmail: vi.fn(),
  sendInquiryMessageAnglerEmail: vi.fn(),
  sendRichOfferAnglerEmail: vi.fn(),
  sendGuideAssignedEmail: vi.fn(),
}))

vi.mock('@/lib/app-url', () => ({
  getAppUrl: vi.fn().mockResolvedValue('https://test.example.com'),
}))

vi.mock('@/lib/inquiries/create', () => ({
  createInquiry: vi.fn(),
}))

vi.mock('@/lib/ai/extract-trip', () => ({
  extractTripDetails: vi.fn(),
  assembleConversation: vi.fn().mockReturnValue('conversation'),
}))

// Import these AFTER mocks are set up
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/guards'

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Mock: no session */
function mockNoSession() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

/** Mock: logged-in but role='guide' (not admin) */
function mockNonAdmin() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: 'guide' }, error: null }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

/** Mock: guide session but the inquiry lookup returns null (different guide) */
function mockGuideNotAssigned() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u-guide' } }, error: null }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'guides') {
        // requireGuide: guides.select('id').eq('user_id', userId).single()
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 'guide-1' }, error: null }),
            }),
          }),
        }
      }
      // inquiries table: .select('id').eq('id', ...).eq('assigned_guide_id', guide.id).single()
      // Returns null — inquiry not assigned to this guide
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
            }),
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>)
}

/** Mock: expired offer token (requireToken should throw) */
function mockExpiredOfferToken() {
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'inq-1',
              offer_token_expires_at: new Date(Date.now() - 60_000).toISOString(),
            },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

/** Mock: expired review token */
function mockExpiredReviewToken() {
  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'rev-1',
              token_expires_at: new Date(Date.now() - 60_000).toISOString(),
            },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── admin.ts ──────────────────────────────────────────────────────────────────

describe('admin.ts', () => {
  describe('createBetaGuide', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { createBetaGuide } = await import('@/actions/admin')
      await expect(
        createBetaGuide({
          full_name: 'Test Guide',
          country: 'IS',
          languages: ['en'],
          fish_expertise: ['salmon'],
          pricing_model: 'flat_fee',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('throws UnauthorizedError when caller is not admin', async () => {
      mockNonAdmin()
      const { createBetaGuide } = await import('@/actions/admin')
      await expect(
        createBetaGuide({
          full_name: 'Test Guide',
          country: 'IS',
          languages: ['en'],
          fish_expertise: ['salmon'],
          pricing_model: 'flat_fee',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe('deleteGuide', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { deleteGuide } = await import('@/actions/admin')
      await expect(deleteGuide('guide-id')).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe('updateGuide', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { updateGuide } = await import('@/actions/admin')
      await expect(
        updateGuide('guide-id', {
          full_name: 'Test',
          country: 'IS',
          languages: ['en'],
          fish_expertise: ['salmon'],
          pricing_model: 'flat_fee',
          status: 'active',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── inquiries.ts ─────────────────────────────────────────────────────────────

describe('inquiries.ts', () => {
  describe('deleteInquiry', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { deleteInquiry } = await import('@/actions/inquiries')
      await expect(deleteInquiry('inq-1')).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('throws UnauthorizedError when caller is not admin', async () => {
      mockNonAdmin()
      const { deleteInquiry } = await import('@/actions/inquiries')
      await expect(deleteInquiry('inq-1')).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe('respondToAssignment — ownership check', () => {
    it('throws UnauthorizedError when inquiry is not assigned to this guide', async () => {
      mockGuideNotAssigned()
      const { respondToAssignment } = await import('@/actions/inquiries')
      await expect(
        respondToAssignment('inq-belonging-to-other-guide', true),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe('submitOfferAnswers — expired token', () => {
    it('throws UnauthorizedError when the offer token has expired', async () => {
      mockExpiredOfferToken()
      const { submitOfferAnswers } = await import('@/actions/inquiries')
      await expect(
        submitOfferAnswers('expired-token', []),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── reviews.ts ───────────────────────────────────────────────────────────────

describe('reviews.ts', () => {
  describe('generateReviewLink', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { generateReviewLink } = await import('@/actions/reviews')
      await expect(generateReviewLink('inq-1')).rejects.toBeInstanceOf(UnauthorizedError)
    })

    it('throws UnauthorizedError when caller is not admin', async () => {
      mockNonAdmin()
      const { generateReviewLink } = await import('@/actions/reviews')
      await expect(generateReviewLink('inq-1')).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe('submitReview — expired token', () => {
    it('throws UnauthorizedError when the review token has expired', async () => {
      mockExpiredReviewToken()
      const { submitReview } = await import('@/actions/reviews')
      await expect(
        submitReview('expired-token', { overallRating: 5 }),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── guide-photos.ts ──────────────────────────────────────────────────────────

describe('guide-photos.ts', () => {
  describe('saveGuidePhotos', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { saveGuidePhotos } = await import('@/actions/guide-photos')
      await expect(saveGuidePhotos([])).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── ads.ts ───────────────────────────────────────────────────────────────────

describe('ads.ts', () => {
  describe('addAdCampaign', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { addAdCampaign } = await import('@/actions/ads')
      await expect(
        addAdCampaign({
          date: '2026-01-01',
          platform: 'google',
          campaign_name: 'test',
          spend: 100,
          impressions: 1000,
          clicks: 10,
          avg_cpc: 10,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── ai.ts ────────────────────────────────────────────────────────────────────

describe('ai.ts', () => {
  describe('setAgentStatus', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { setAgentStatus } = await import('@/actions/ai')
      await expect(setAgentStatus('inq-1', 'stopped')).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── availability.ts ──────────────────────────────────────────────────────────

describe('availability.ts', () => {
  describe('setOpenSeason', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { setOpenSeason } = await import('@/actions/availability')
      await expect(setOpenSeason('2026-06-01', '2026-09-30')).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── dashboard.ts ─────────────────────────────────────────────────────────────

describe('dashboard.ts', () => {
  describe('updateGuideProfile', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { updateGuideProfile } = await import('@/actions/dashboard')
      await expect(updateGuideProfile({} as Parameters<typeof updateGuideProfile>[0])).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── experience-pages.ts ──────────────────────────────────────────────────────

describe('experience-pages.ts', () => {
  describe('createExperiencePage', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { createExperiencePage } = await import('@/actions/experience-pages')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(createExperiencePage({} as any)).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── finances.ts ──────────────────────────────────────────────────────────────

describe('finances.ts', () => {
  describe('addFixedCost', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { addFixedCost } = await import('@/actions/finances')
      await expect(
        addFixedCost({ name: 'test', amount_pln: 100, billing_cycle: 'monthly', category: 'other' }),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── guide-forms.ts ───────────────────────────────────────────────────────────

describe('guide-forms.ts', () => {
  describe('createIntakeForm', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { createIntakeForm } = await import('@/actions/guide-forms')
      await expect(createIntakeForm('Test Form', null, [])).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── messages.ts ──────────────────────────────────────────────────────────────

describe('messages.ts', () => {
  describe('matchUnmatchedMessage', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { matchUnmatchedMessage } = await import('@/actions/messages')
      await expect(matchUnmatchedMessage('msg-1', 'inq-1')).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── offer-photos.ts ──────────────────────────────────────────────────────────

describe('offer-photos.ts', () => {
  describe('uploadOfferPhoto', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { uploadOfferPhoto } = await import('@/actions/offer-photos')
      await expect(uploadOfferPhoto(new FormData())).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── review-media.ts ──────────────────────────────────────────────────────────

describe('review-media.ts', () => {
  describe('getReviewUploadUrl — expired token', () => {
    it('throws UnauthorizedError when the review token has expired', async () => {
      mockExpiredReviewToken()
      const { getReviewUploadUrl } = await import('@/actions/review-media')
      await expect(
        getReviewUploadUrl('expired-token', 'photo.jpg', 'image/jpeg'),
      ).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── submissions.ts ───────────────────────────────────────────────────────────

describe('submissions.ts', () => {
  describe('markSubmissionInProgress', () => {
    it('throws UnauthorizedError when there is no session', async () => {
      mockNoSession()
      const { markSubmissionInProgress } = await import('@/actions/submissions')
      await expect(markSubmissionInProgress('sub-1')).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })
})

// ─── auth.ts — role elevation prevention ──────────────────────────────────────

describe('auth.ts', () => {
  describe('signUp — role clamping', () => {
    it('clamps role to angler when an elevated role is passed', async () => {
      let capturedRole: string | undefined

      vi.mocked(createServiceClient).mockReturnValue({
        auth: {
          admin: {
            createUser: async () => ({ data: { user: { id: 'u-new' } }, error: null }),
          },
        },
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              upsert: (data: Record<string, unknown>) => {
                capturedRole = data.role as string
                return { error: null }
              },
            }
          }
          return { upsert: async () => ({ error: null }) }
        },
      } as unknown as ReturnType<typeof createServiceClient>)

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          signInWithPassword: async () => ({ error: null }),
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>)

      const { signUp } = await import('@/actions/auth')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await signUp('Test User', 'test@example.com', 'password123', 'admin' as any)

      expect(capturedRole).not.toBe('admin')
      expect(capturedRole).toBe('angler')
    })
  })
})
