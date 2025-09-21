import { NextResponse } from 'next/server'

export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || 'unknown'
  const buildTime = process.env.VERCEL_BUILD_TIME || new Date().toISOString()
  return NextResponse.json({ commit, buildTime })
}

