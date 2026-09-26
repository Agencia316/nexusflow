import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const token = process.env.ZAPSIGN_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'ZapSign token not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'signed'
  const page_size = searchParams.get('page_size') ?? '100'
  const page = searchParams.get('page') ?? '1'

  const zapUrl = `https://api.zapsign.com.br/api/v1/docs/?status=${status}&page_size=${page_size}&page=${page}`

  const res = await fetch(zapUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: `ZapSign API error: ${res.status}` },
      { status: res.status }
    )
  }

  const data = await res.json()

  // Rewrite pagination URL so the browser calls our proxy instead of ZapSign directly
  if (data.next) {
    try {
      const nextUrl = new URL(data.next)
      data.next = '/api/zapsign?' + nextUrl.searchParams.toString()
    } catch {
      data.next = null
    }
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
