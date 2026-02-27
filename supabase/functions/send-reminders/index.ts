import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type ActionType = 'test' | 'reminder'

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
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const { data: subscriptions, error: subErr } = await admin
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth')
      .eq('user_id', user.id)

    if (subErr) throw subErr

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'No subscriptions found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let payload = { title: '喵记测试推送', body: '推送链路正常 ✅', url: '/' }

    if (action === 'reminder') {
      const catId = body.catId

      let hasUrgentInventory = false
      let dewormingDueSoon = false

      if (catId) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowDate = tomorrow.toISOString().split('T')[0]

        const [{ data: invRows }, { data: healthRows }] = await Promise.all([
          admin
            .from('inventory')
            .select('id,status')
            .eq('cat_id', catId)
            .eq('status', 'urgent')
            .limit(1),
          admin
            .from('health_records')
            .select('id,next_due,type')
            .eq('cat_id', catId)
            .eq('type', 'deworming')
            .not('next_due', 'is', null)
            .lte('next_due', tomorrowDate)
            .order('date', { ascending: false })
            .limit(1),
        ])

        hasUrgentInventory = Boolean(invRows && invRows.length > 0)
        dewormingDueSoon = Boolean(healthRows && healthRows.length > 0)
      }

      if (hasUrgentInventory || dewormingDueSoon) {
        payload = {
          title: '喵记提醒',
          body: `${hasUrgentInventory ? '物资库存告急' : ''}${hasUrgentInventory && dewormingDueSoon ? '；' : ''}${dewormingDueSoon ? '驱虫时间临近' : ''}`,
          url: '/',
        }
      } else {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'No reminder conditions met' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    webpush.setVapidDetails('mailto:cat-diary@example.com', vapidPublic, vapidPrivate)

    const invalidSubIds: string[] = []
    let delivered = 0

    for (const sub of subscriptions as PushSubRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
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
      if (!delErr) {
        removed = invalidSubIds.length
      }
    }

    return new Response(JSON.stringify({ delivered, removed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
