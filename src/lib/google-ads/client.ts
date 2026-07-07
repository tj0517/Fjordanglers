import { GoogleAdsApi, Customer } from 'google-ads-api'
import { env } from '@/lib/env'

let _api: GoogleAdsApi | null = null

function getApi(): GoogleAdsApi {
  if (!_api) {
    _api = new GoogleAdsApi({
      client_id: env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    })
  }
  return _api
}

export function getCustomer(): Customer {
  return getApi().Customer({
    customer_id: env.GOOGLE_ADS_CUSTOMER_ID!,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN!,
  })
}

/** Returns true if all required Google Ads env vars are set. */
export function isGoogleAdsConfigured(): boolean {
  return !!(
    env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    env.GOOGLE_ADS_CLIENT_ID &&
    env.GOOGLE_ADS_CLIENT_SECRET &&
    env.GOOGLE_ADS_REFRESH_TOKEN &&
    env.GOOGLE_ADS_CUSTOMER_ID
  )
}
