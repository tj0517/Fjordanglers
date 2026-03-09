/**
 * Central re-export for Supabase helpers.
 *
 * Import browser client:
 *   import { createClient } from '@/lib/supabase/client'
 *
 * Import server client:
 *   import { createClient, createServiceClient } from '@/lib/supabase/server'
 *
 * Import types:
 *   import type { Database, Tables, Enums } from '@/lib/supabase'
 */

export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from './database.types'
