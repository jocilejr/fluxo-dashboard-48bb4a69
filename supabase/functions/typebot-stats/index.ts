import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TYPEBOT_BASE_URL = 'https://typebot.origemdavida.online'
const WORKSPACE_ID = 'cmghj8t790000o918ec7vgtt8'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function getAllTypebots(typebotToken: string): Promise<any[]> {
  const listUrl = `${TYPEBOT_BASE_URL}/api/v1/typebots?workspaceId=${WORKSPACE_ID}`
  console.log('[typebot-stats] Listing all typebots from workspace')

  const listResponse = await fetch(listUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${typebotToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!listResponse.ok) return []

  const listData = await listResponse.json()
  return listData.typebots || listData || []
}

async function getTypebotResults(typebotToken: string, typebotId: string, fromDate?: Date, toDate?: Date): Promise<any[]> {
  let allResults: any[] = []
  let cursor: string | null = null
  let hasMore = true
  
  while (hasMore) {
    const url: string = cursor 
      ? `${TYPEBOT_BASE_URL}/api/v1/typebots/${typebotId}/results?limit=100&cursor=${cursor}`
      : `${TYPEBOT_BASE_URL}/api/v1/typebots/${typebotId}/results?limit=100`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${typebotToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('[typebot-stats] Error fetching results for', typebotId)
      return allResults
    }

    const data = await response.json()
    const results = data.results || []
    
    // Filter by date range if provided
    if (fromDate && toDate) {
      for (const result of results) {
        const createdAt = new Date(result.createdAt)
        if (createdAt >= fromDate && createdAt <= toDate) {
          allResults.push(result)
        }
      }
    } else {
      allResults = [...allResults, ...results]
    }
    
    if (data.nextCursor) {
      cursor = data.nextCursor
    } else {
      hasMore = false
    }
    
    // Safety limit
    if (allResults.length >= 10000) {
      hasMore = false
    }
  }
  
  return allResults
}

async function getTypebotDetails(typebotToken: string, typebotId: string): Promise<any> {
  const url = `${TYPEBOT_BASE_URL}/api/v1/typebots/${typebotId}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${typebotToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) return null
  
  const data = await response.json()
  return data.typebot || data
}

function buildBlockNameMap(typebotDetails: any): Record<string, { name: string; type: string; question: string | null }> {
  const blockNameMap: Record<string, { name: string; type: string; question: string | null }> = {}
  const groups = typebotDetails?.groups || []
  
  for (const group of groups) {
    const groupName = group.title || group.name || 'Grupo'
    const blocks = group.blocks || []
    
    let lastTextContent: string | null = null
    
    for (const block of blocks) {
      const blockType = (block.type || '').toLowerCase()
      
      // Capture text blocks content (bot messages) - check multiple formats
      if (blockType === 'text' || blockType === 'bubble text') {
        // Try different content structures
        if (block.content?.richText && Array.isArray(block.content.richText)) {
          const texts: string[] = []
          for (const rt of block.content.richText) {
            if (rt.children && Array.isArray(rt.children)) {
              for (const child of rt.children) {
                if (child.text) texts.push(child.text)
              }
            }
          }
          if (texts.length > 0) {
            lastTextContent = texts.join(' ').trim()
          }
        } else if (block.content?.html) {
          // Strip HTML tags
          lastTextContent = block.content.html.replace(/<[^>]*>/g, '').trim()
        } else if (block.content?.plainText) {
          lastTextContent = block.content.plainText.trim()
        }
      }
      
      if (block.id) {
        // For input blocks, use the last text content as the question
        let question: string | null = null
        if (blockType.includes('input')) {
          question = lastTextContent
          // Do NOT use placeholder as fallback - that's not the bot's message
        }
        
        blockNameMap[block.id] = {
          name: groupName,
          type: block.type || 'unknown',
          question
        }
      }
    }
  }
  
  return blockNameMap
}

function analyzeResults(results: any[], typebotDetails: any): any {
  const totalLeads = results.length
  const completedLeads = results.filter(r => r.isCompleted).length
  const completionRate = totalLeads > 0 ? (completedLeads / totalLeads * 100).toFixed(1) : 0
  
  // Analyze answers to find drop-off points
  const answerCounts: Record<string, number> = {}
  const lastAnswers: Record<string, number> = {}
  
  for (const result of results) {
    const answers = result.answers || []
    
    // Count how many people answered each question
    for (const answer of answers) {
      const blockId = answer.blockId || 'unknown'
      answerCounts[blockId] = (answerCounts[blockId] || 0) + 1
    }
    
    // Track last answer (drop-off point) for incomplete leads
    if (!result.isCompleted && answers.length > 0) {
      const lastAnswer = answers[answers.length - 1]
      const blockId = lastAnswer?.blockId || 'unknown'
      lastAnswers[blockId] = (lastAnswers[blockId] || 0) + 1
    }
  }
  
  const blockNameMap = buildBlockNameMap(typebotDetails)
  
  // Build funnel data
  const funnelSteps = Object.entries(answerCounts)
    .map(([blockId, count]) => ({
      blockId,
      name: blockNameMap[blockId]?.name || `Etapa ${blockId.substring(0, 8)}`,
      count,
      percentage: totalLeads > 0 ? (count / totalLeads * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  
  // Build drop-off points
  const dropOffPoints = Object.entries(lastAnswers)
    .map(([blockId, count]) => ({
      blockId,
      name: blockNameMap[blockId]?.name || `Etapa ${blockId.substring(0, 8)}`,
      count,
      percentage: totalLeads > 0 ? (count / totalLeads * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  // Analyze by hour (Brazil timezone UTC-3)
  const hourlyDistribution: Record<number, number> = {}
  for (const result of results) {
    const date = new Date(result.createdAt)
    // Convert to Brazil timezone (UTC-3)
    const brazilHour = (date.getUTCHours() - 3 + 24) % 24
    hourlyDistribution[brazilHour] = (hourlyDistribution[brazilHour] || 0) + 1
  }
  
  const peakHour = Object.entries(hourlyDistribution)
    .sort((a, b) => b[1] - a[1])[0]
  
  return {
    totalLeads,
    completedLeads,
    incompletedLeads: totalLeads - completedLeads,
    completionRate: Number(completionRate),
    funnelSteps,
    dropOffPoints,
    peakHour: peakHour ? { hour: Number(peakHour[0]), count: peakHour[1] } : null,
    hourlyDistribution: Object.entries(hourlyDistribution).map(([hour, count]) => ({
      hour: Number(hour),
      count
    })).sort((a, b) => a.hour - b.hour)
  }
}

function buildLeadLogs(results: any[], typebotDetails: any): any[] {
  const blockNameMap = buildBlockNameMap(typebotDetails)
  
  return results.map(result => {
    const answers = result.answers || []
    
    // Build formatted answers with field names, types, and bot questions
    const formattedAnswers = answers.map((answer: any) => {
      const blockInfo = blockNameMap[answer.blockId]
      return {
        field: blockInfo?.name || answer.blockId,
        type: blockInfo?.type || 'unknown',
        question: blockInfo?.question || null,
        value: answer.content || ''
      }
    })
    
    return {
      id: result.id,
      createdAt: result.createdAt,
      isCompleted: result.isCompleted,
      answers: formattedAnswers
    }
  }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

Deno.serve(async (req) => {
  console.log('[typebot-stats] Request received')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const typebotToken = Deno.env.get('TYPEBOT_API_TOKEN')
    
    if (!typebotToken) {
      console.error('[typebot-stats] TYPEBOT_API_TOKEN not configured')
      return new Response(
        JSON.stringify({ error: 'Typebot API token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'stats'

    // LIST: List all typebots in workspace
    if (action === 'list') {
      const typebots = await getAllTypebots(typebotToken)
      console.log('[typebot-stats] Found', typebots.length, 'typebots')

      return new Response(
        JSON.stringify({ typebots: typebots.map(t => ({ id: t.id, name: t.name })) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // RANKING: Get typebots ranked by leads
    if (action === 'ranking') {
      const fromDate = body.fromDate ? new Date(body.fromDate) : new Date()
      const toDate = body.toDate ? new Date(body.toDate) : new Date()
      const specificTypebotId = body.typebotId
      
      console.log('[typebot-stats] Ranking for period:', fromDate.toISOString(), '-', toDate.toISOString())

      // If specific typebot, just get its count
      if (specificTypebotId) {
        const results = await getTypebotResults(typebotToken, specificTypebotId, fromDate, toDate)
        const details = await getTypebotDetails(typebotToken, specificTypebotId)
        
        return new Response(
          JSON.stringify({ 
            ranking: [{ 
              id: specificTypebotId, 
              name: details?.name || 'Typebot', 
              count: results.length,
              completed: results.filter(r => r.isCompleted).length
            }] 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const typebots = await getAllTypebots(typebotToken)
      console.log('[typebot-stats] Found', typebots.length, 'typebots in workspace')

      // Get results count for each typebot
      const rankingPromises = typebots.map(async (typebot: any) => {
        const results = await getTypebotResults(typebotToken, typebot.id, fromDate, toDate)
        return {
          id: typebot.id,
          name: typebot.name,
          count: results.length,
          completed: results.filter((r: any) => r.isCompleted).length
        }
      })

      const ranking = await Promise.all(rankingPromises)
      
      // Sort by count descending
      const sortedRanking = ranking.sort((a, b) => b.count - a.count)

      console.log('[typebot-stats] Ranking calculated with', sortedRanking.length, 'typebots')

      return new Response(
        JSON.stringify({ ranking: sortedRanking }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DETAILS: Get detailed analytics for a specific typebot
    if (action === 'details') {
      const typebotId = body.typebotId
      if (!typebotId) {
        return new Response(
          JSON.stringify({ error: 'typebotId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const fromDate = body.fromDate ? new Date(body.fromDate) : new Date()
      const toDate = body.toDate ? new Date(body.toDate) : new Date()
      
      console.log('[typebot-stats] Getting details for typebot:', typebotId)

      const [results, typebotDetails] = await Promise.all([
        getTypebotResults(typebotToken, typebotId, fromDate, toDate),
        getTypebotDetails(typebotToken, typebotId)
      ])

      const analytics = analyzeResults(results, typebotDetails)
      const logs = buildLeadLogs(results, typebotDetails)

      return new Response(
        JSON.stringify({ 
          typebot: {
            id: typebotId,
            name: typebotDetails?.name || 'Typebot'
          },
          analytics,
          logs
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SYNC: Sync daily stats to database (for historical data)
    if (action === 'sync') {
      const targetDate = body.date ? new Date(body.date) : new Date()
      const dateStr = targetDate.toISOString().split('T')[0]
      
      const startOfDay = new Date(dateStr + 'T00:00:00.000Z')
      const endOfDay = new Date(dateStr + 'T23:59:59.999Z')
      
      console.log('[typebot-stats] Syncing stats for date:', dateStr)

      const typebots = await getAllTypebots(typebotToken)
      
      for (const typebot of typebots) {
        const results = await getTypebotResults(typebotToken, typebot.id, startOfDay, endOfDay)
        const completedCount = results.filter(r => r.isCompleted).length
        
        // Upsert to database
        const { error } = await supabase
          .from('typebot_daily_stats')
          .upsert({
            typebot_id: typebot.id,
            typebot_name: typebot.name,
            date: dateStr,
            total_leads: results.length,
            completed_leads: completedCount,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'typebot_id,date'
          })
        
        if (error) {
          console.error('[typebot-stats] Error upserting stats:', error)
        }
      }

      return new Response(
        JSON.stringify({ success: true, date: dateStr, typebotsProcessed: typebots.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // HISTORY: Get historical data from database
    if (action === 'history') {
      const typebotId = body.typebotId
      const days = body.days || 30
      
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)
      
      let query = supabase
        .from('typebot_daily_stats')
        .select('*')
        .gte('date', fromDate.toISOString().split('T')[0])
        .order('date', { ascending: true })
      
      if (typebotId) {
        query = query.eq('typebot_id', typebotId)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('[typebot-stats] Error fetching history:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch history' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ history: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[typebot-stats] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
