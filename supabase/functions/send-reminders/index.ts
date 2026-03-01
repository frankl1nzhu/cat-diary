import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type ActionType =
  | 'test' | 'reminder' | 'diary' | 'comment' | 'scoop' | 'vapid-public-key'
  | 'feed' | 'health' | 'inventory' | 'weight' | 'cat-profile' | 'family-member' | 'new-cat'
  | 'abnormal-poop' | 'weekly-summary' | 'weekly-summary-cron' | 'miss'

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
  diaryAuthorId?: string
  mealType?: string
  healthType?: string
  healthName?: string
  itemName?: string
  weightKg?: number
  memberName?: string
  bristolType?: string
  poopColor?: string
  familyId?: string
}

function getUserIdFromJwt(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.')
    if (parts.length < 2) return null
    const payloadRaw = parts[1]
    const payloadBase64 = payloadRaw.replace(/-/g, '+').replace(/_/g, '/')
    const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4)
    const payloadJson = atob(padded)
    const payload = JSON.parse(payloadJson) as { sub?: string }
    return payload.sub || null
  } catch {
    return null
  }
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

/** Get all user IDs in a family by familyId, optionally excluding one user */
async function getFamilyMemberIdsByFamilyId(
  admin: ReturnType<typeof createClient>,
  familyId: string,
  excludeUserId?: string
): Promise<string[]> {
  const { data: members } = await admin
    .from('family_members')
    .select('user_id')
    .eq('family_id', familyId)

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
    const body: ReqBody = await req.json().catch(() => ({}))
    const action: ActionType = body.action || 'test'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing required secrets for push delivery' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'vapid-public-key') {
      if (!vapidPublic) {
        return new Response(JSON.stringify({ error: 'VAPID public key is missing' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ vapidPublicKey: vapidPublic }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: 'Missing required secrets for push delivery' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    let userId: string | null = null
    let userErrorMessage: string | null = null
    const authHeader = req.headers.get('Authorization')
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || ''

    if (accessToken) {
      const {
        data: serviceUserData,
        error: serviceUserErr,
      } = await admin.auth.getUser(accessToken)

      if (serviceUserData?.user?.id) {
        userId = serviceUserData.user.id
      } else {
        userErrorMessage = serviceUserErr?.message || 'service-role getUser failed'
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY')
        if (anonKey) {
          const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
          })
          const {
            data: anonUserData,
            error: anonUserErr,
          } = await userClient.auth.getUser()

          if (anonUserData?.user?.id) {
            userId = anonUserData.user.id
            userErrorMessage = null
          } else {
            userErrorMessage = `${userErrorMessage}; anon-client getUser failed: ${anonUserErr?.message || 'unknown'}`
          }
        }

        if (!userId) {
          const jwtUserId = getUserIdFromJwt(accessToken)
          if (jwtUserId) {
            userId = jwtUserId
            userErrorMessage = null
          }
        }
      }
    } else {
      userErrorMessage = 'missing authorization header'
    }

    if (!['vapid-public-key', 'weekly-summary-cron'].includes(action) && !userId) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${userErrorMessage || 'missing user context'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    webpush.setVapidDetails('mailto:cat-diary@example.com', vapidPublic, vapidPrivate)

    /* ── test: send to requesting user only ── */
    if (action === 'test') {
      if (!userId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: `Missing user context: ${userErrorMessage || 'unknown'}` }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const result = await sendPushToUsers(admin, [userId], {
        title: '测试推送 🔔',
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

      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
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

    /* ── comment: notify diary AUTHOR when someone else comments ── */
    if (action === 'comment') {
      const authorId = body.diaryAuthorId
      const catName = body.catName || '猫咪'
      if (!authorId || (userId && authorId === userId)) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'No notification needed' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const result = await sendPushToUsers(admin, [authorId], {
        title: `${catName} 的日记有新评论 💬`,
        body: '快来看看吧~',
        url: '/log',
      })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── scoop: notify OTHER family members when someone logged poop ── */
    if (action === 'scoop') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 刚刚铲屎了 💩`,
        body: '快去看看今日记录吧~',
        url: '/dashboard?quick=poop',
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
        title: '提醒 🔔',
        body: parts.join('；'),
        url: '/',
      })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── feed: notify OTHER family members when someone logged feeding ── */
    if (action === 'feed') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      const mealLabel = body.mealType || '喂食'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 已喂食 🍽️`,
        body: `${mealLabel}已记录~`,
        url: '/',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── abnormal-poop: notify OTHER family members about abnormal poop ── */
    if (action === 'abnormal-poop') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      const bristolType = body.bristolType || '?'
      const poopColor = body.poopColor || '?'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `⚠️ ${catName} 便便异常`,
        body: `类型${bristolType}，颜色${poopColor}，请关注`,
        url: '/?quick=poop',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── health: notify OTHER family members about new health record ── */
    if (action === 'health') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      const healthType = body.healthType || '健康'
      const healthName = body.healthName || ''
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 新${healthType}记录 🩺`,
        body: healthName ? `${healthName}` : `已记录${healthType}`,
        url: '/stats',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── inventory: notify OTHER family members about new/updated inventory ── */
    if (action === 'inventory') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      const itemName = body.itemName || '物资'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 库存更新 🛒`,
        body: `${itemName} 已更新`,
        url: '/stats',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── weight: notify OTHER family members about weight record ── */
    if (action === 'weight') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      const weightKg = body.weightKg
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 体重记录 ⚖️`,
        body: weightKg ? `最新体重 ${weightKg}kg` : '体重已更新',
        url: '/stats',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── cat-profile: notify OTHER family members about cat profile change ── */
    if (action === 'cat-profile') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 档案已更新 🐱`,
        body: '猫咪档案有变动，快来看看~',
        url: '/settings',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── family-member: notify OTHER family members when someone joins ── */
    if (action === 'family-member') {
      const familyId = body.familyId
      const memberName = body.memberName || '新成员'
      if (!familyId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing familyId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIdsByFamilyId(admin, familyId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: '新成员加入啦 🎉',
        body: `${memberName} 加入了家庭`,
        url: '/settings',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── new-cat: notify OTHER family members when a cat is added ── */
    if (action === 'new-cat') {
      const catId = body.catId
      const catName = body.catName || '新猫咪'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `新猫咪加入 🐾`,
        body: `${catName} 来到了这个家！`,
        url: '/settings',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── miss: notify OTHER family members when someone misses the cat ── */
    if (action === 'miss') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const memberIds = await getFamilyMemberIds(admin, catId, userId || undefined)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 被想啦 🥹`,
        body: '速速发咪照，不要不识好歹',
        url: '/',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── weekly-summary: send weekly summary to all family members of a cat ── */
    if (action === 'weekly-summary') {
      const catId = body.catId
      const catName = body.catName || '猫咪'
      if (!catId) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'Missing catId' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Gather weekly data
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = weekAgo.toISOString()

      const [{ data: feeds }, { data: poops }, { data: weights }] = await Promise.all([
        admin.from('feed_status').select('id').eq('cat_id', catId).gte('fed_at', weekAgoStr),
        admin.from('poop_logs').select('id,bristol_type,color').eq('cat_id', catId).gte('created_at', weekAgoStr),
        admin.from('weight_records').select('weight_kg').eq('cat_id', catId).order('recorded_at', { ascending: false }).limit(1),
      ])

      const feedCount = feeds?.length || 0
      const poopCount = poops?.length || 0
      const abnormalCount = poops?.filter((p: { bristol_type: string; color: string }) =>
        Number(p.bristol_type) >= 6 || ['red', 'black', 'white'].includes(p.color)
      ).length || 0
      const latestWeight = weights?.[0]?.weight_kg

      const parts: string[] = []
      parts.push(`喂食${feedCount}次`)
      parts.push(`铲屎${poopCount}次`)
      if (abnormalCount > 0) parts.push(`异常便便${abnormalCount}次⚠️`)
      if (latestWeight) parts.push(`体重${latestWeight}kg`)

      const memberIds = await getFamilyMemberIds(admin, catId)
      const result = await sendPushToUsers(admin, memberIds, {
        title: `${catName} 每周总结 📊`,
        body: parts.join('，'),
        url: '/',
      })
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /* ── weekly-summary-cron: server scheduled weekly summary for all cats ── */
    if (action === 'weekly-summary-cron') {
      const { data: cats } = await admin
        .from('cats')
        .select('id,name')

      if (!cats || cats.length === 0) {
        return new Response(JSON.stringify({ delivered: 0, removed: 0, message: 'No cats found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let delivered = 0
      let removed = 0

      for (const cat of cats as { id: string; name: string }[]) {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const weekAgoStr = weekAgo.toISOString()

        const [{ data: feeds }, { data: poops }, { data: weights }] = await Promise.all([
          admin.from('feed_status').select('id').eq('cat_id', cat.id).gte('fed_at', weekAgoStr),
          admin.from('poop_logs').select('id,bristol_type,color').eq('cat_id', cat.id).gte('created_at', weekAgoStr),
          admin.from('weight_records').select('weight_kg').eq('cat_id', cat.id).order('recorded_at', { ascending: false }).limit(1),
        ])

        const feedCount = feeds?.length || 0
        const poopCount = poops?.length || 0
        const abnormalCount = poops?.filter((p: { bristol_type: string; color: string }) =>
          Number(p.bristol_type) >= 6 || ['red', 'black', 'white'].includes(p.color)
        ).length || 0
        const latestWeight = weights?.[0]?.weight_kg

        const parts: string[] = []
        parts.push(`喂食${feedCount}次`)
        parts.push(`铲屎${poopCount}次`)
        if (abnormalCount > 0) parts.push(`异常便便${abnormalCount}次⚠️`)
        if (latestWeight) parts.push(`体重${latestWeight}kg`)

        const memberIds = await getFamilyMemberIds(admin, cat.id)
        const result = await sendPushToUsers(admin, memberIds, {
          title: `${cat.name || '猫咪'} 每周总结 📊`,
          body: parts.join('，'),
          url: '/',
        })
        delivered += result.delivered
        removed += result.removed
      }

      return new Response(JSON.stringify({ delivered, removed }), {
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
