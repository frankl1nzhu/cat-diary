import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type ActionType = 'test' | 'reminder' | 'diary'

interface PushSubRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface ReqBody {
  action?: ActionType
  catId?: string
  catName?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get all user IDs in the same family as a given cat, optionally excluding one user */
async function getFamilyMemberIds(
  admin: ReturnType<typeof createClient>,
  catId: string,
  excludeUserId?: string
): Promise<string[]> {
  // 1. find the cat's family_id
  const { data: catRow } = await admin
    .from('cats')
    .select('family_id')
    .eq('id', catId)
    .single()

  if (!catRow?.family_id) return []

  // 2. get all members in that family
  const { data: members } = await admin
    .from('family_members')
    .select('user_id')
    .eq('family_id', catRow.family_id)

  if (!members) return []

  const ids = members.map((m: { user_id: string }) => m.user_id)
  return excludeUserId ? ids.filter((id: string) => id !== excludeUserId) : ids
}

/** Send a push payload to a list of user IDs; returns { delivered, removed } */
async function sendPushToUsers(
  admin: ReturnType<typeof createClient>,
  userIds: string[],
  payload: object
): Promise<{ delivered: number; removed: number }> {
  if (userIds.length === 0) return { delivered: 0, removed: 0 }

  const { data: subscriptions, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', userIds)

  if (subErr) throw subErr
  if (!subscriptions || subscriptions.length === 0) return { delivered: 0, removed: 0 }

  const invalidSubIds: string[] = []
  let delivered = 0

  for (const sub of subscriptions as PushSubRow[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      delivered += 1
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        invalidSubIds.push(sub.id)
      }
    }
  }

  let removed = 0
  if (invalidSubIds.length > 0) {
    const { error: delErr } = await admin
      .from('push_subscriptions')
      .delete()
      .in('id', invalidSubIds)
    if (!delErr) removed = invalidSubIds.length
  }

  return { delivered, removed }
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY')
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey || !vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: 'Missing required secrets for push delivery' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user context' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: ReqBody = await req.json().catch(() => ({}))
    const action: ActionType = body.action || 'test'

    const admin = createClient(supabaseUrl, serviceRoleKey)
    webpush.setVapidDetails('mailto:cat-diary@example.com', vapidPublic, vapidPrivate)

    /* ── test: send to requesting user only ── */
    if (action === 'test') {
      const result = await sendPushToUsers(admin, [user.id], {
        title: '喵记测试推送',
        body: '推送链路正常 ✅',
        url: '/',
      })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── diary: notify OTHER family members ── */
    if (action === 'diary') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const memberIds = await getFamilyMemberIds(admin, catId, user.id)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 有新日记啦 📝`,
        body: '快来看看吧~',
        url: '/log',
      })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── reminder: check inventory & health, notify ALL family members ── */
    if (action === 'reminder') {
      const catId = body.catId
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowDate = tomorrow.toISOString().split('T')[0]

      const [{ data: invRows }, { data: healthRows }] = await Promise.all([
        admin
          .from('inventory')
          .select('id,status')
          .eq('cat_id', catId)
          .in('status', ['urgent', 'low'])
          .limit(1),
        admin
          .from('health_records')
          .select('id,next_due,type')
          .eq('cat_id', catId)
          .in('type', ['deworming', 'vaccine'])
          .not('next_due', 'is', null)
          .lte('next_due', tomorrowDate)
          .order('date', { ascending: false })
          .limit(5),
      ])

      const hasUrgentInventory = Boolean(invRows && invRows.length > 0)
      const overdueHealth = healthRows && healthRows.length > 0
      const dewormingDue = healthRows?.some((r: { type: string }) => r.type === 'deworming')
      const vaccineDue = healthRows?.some((r: { type: string }) => r.type === 'vaccine')

      if (!hasUrgentInventory && !overdueHealth) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'No reminder conditions met' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const parts: string[] = []
      if (hasUrgentInventory) parts.push('物资库存告急')
      if (dewormingDue) parts.push('驱虫时间到期')
      if (vaccineDue) parts.push('疫苗接种到期')

      const memberIds = await getFamilyMemberIds(admin, catId)
      const result = await sendPushToUsers(admin, memberIds, {
        title: '喵记提醒 🔔',
        body: parts.join('；'),
        url: '/',
      })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
