import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// deno-lint-ignore no-explicit-any
async function saveGroupHistory(
  supabase: any,
  groupId: string,
  currentMembers: number,
  todayEntries: number,
  todayExits: number
) {
  const today = new Date().toISOString().split('T')[0]
  
  // Check for existing history record for today
  const { data: existingHistory } = await supabase
    .from('group_statistics_history')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', today)
    .single()

  if (existingHistory) {
    // Update existing history with today's values (not accumulating, just set the current daily values)
    const { error } = await supabase
      .from('group_statistics_history')
      .update({
        entries: todayEntries,
        exits: todayExits,
        current_members: currentMembers,
      })
      .eq('id', existingHistory.id)

    if (error) {
      console.error('Error updating history:', error)
    } else {
      console.log('History updated for group:', groupId, 'entries:', todayEntries, 'exits:', todayExits)
    }
  } else {
    // Create new history record for today
    const { error } = await supabase
      .from('group_statistics_history')
      .insert({
        group_id: groupId,
        date: today,
        entries: todayEntries,
        exits: todayExits,
        current_members: currentMembers,
      })

    if (error) {
      console.error('Error creating history:', error)
    } else {
      console.log('History created for group:', groupId, 'entries:', todayEntries, 'exits:', todayExits)
    }
  }
}

// deno-lint-ignore no-explicit-any
async function processGroup(
  supabase: any,
  group: { whatsapp_id?: string; name?: string; current_members?: number; entries?: number; exits?: number }
) {
  const { whatsapp_id, name, current_members, entries, exits } = group

  if (!name && !whatsapp_id) {
    console.log('Skipping group without name or whatsapp_id')
    return null
  }

  // Try to find existing group by whatsapp_id or name
  let existingGroup = null
  
  if (whatsapp_id) {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('whatsapp_id', whatsapp_id)
      .single()
    existingGroup = data
  }
  
  if (!existingGroup && name) {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('name', name)
      .single()
    existingGroup = data
  }

  const today = new Date().toISOString().split('T')[0]

  if (existingGroup) {
    const newCurrentMembers = current_members ?? existingGroup.current_members
    const incomingEntries = entries ?? existingGroup.total_entries
    const incomingExits = exits ?? existingGroup.total_exits
    
    // Check if we need to reset (new day)
    const lastResetDate = existingGroup.last_reset_date
    const needsReset = lastResetDate !== today
    
    let todayEntries: number
    let todayExits: number
    
    if (needsReset) {
      // It's a new day! Reset the counters
      // Today's entries/exits = incoming total - last day's total
      todayEntries = Math.max(0, incomingEntries - existingGroup.total_entries)
      todayExits = Math.max(0, incomingExits - existingGroup.total_exits)
      
      console.log(`New day detected for group ${name || whatsapp_id}. Resetting counters.`)
      console.log(`Yesterday's total: entries=${existingGroup.total_entries}, exits=${existingGroup.total_exits}`)
      console.log(`Today's incoming: entries=${incomingEntries}, exits=${incomingExits}`)
      console.log(`Today's calculated: entries=${todayEntries}, exits=${todayExits}`)
      
      // Update group with new baseline
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          name: name || existingGroup.name,
          current_members: newCurrentMembers,
          total_entries: incomingEntries,
          total_exits: incomingExits,
          whatsapp_id: whatsapp_id || existingGroup.whatsapp_id,
          last_day_total_entries: existingGroup.total_entries, // Save yesterday's total as baseline
          last_day_total_exits: existingGroup.total_exits,
          last_reset_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingGroup.id)

      if (updateError) {
        console.error('Error updating group:', updateError)
        return { error: updateError }
      }
    } else {
      // Same day - calculate difference from the day's baseline
      todayEntries = Math.max(0, incomingEntries - existingGroup.last_day_total_entries)
      todayExits = Math.max(0, incomingExits - existingGroup.last_day_total_exits)
      
      console.log(`Same day update for group ${name || whatsapp_id}`)
      console.log(`Baseline: entries=${existingGroup.last_day_total_entries}, exits=${existingGroup.last_day_total_exits}`)
      console.log(`Incoming: entries=${incomingEntries}, exits=${incomingExits}`)
      console.log(`Today's: entries=${todayEntries}, exits=${todayExits}`)
      
      // Update group
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          name: name || existingGroup.name,
          current_members: newCurrentMembers,
          total_entries: incomingEntries,
          total_exits: incomingExits,
          whatsapp_id: whatsapp_id || existingGroup.whatsapp_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingGroup.id)

      if (updateError) {
        console.error('Error updating group:', updateError)
        return { error: updateError }
      }
    }

    console.log('Group updated:', name || whatsapp_id)
    // Save history with today's entries/exits only
    await saveGroupHistory(supabase, existingGroup.id, newCurrentMembers, todayEntries, todayExits)
    return { success: true, action: 'updated' }
  } else {
    // Create new group
    const newCurrentMembers = current_members || 0
    const initialEntries = entries || 0
    const initialExits = exits || 0
    
    const { data: newGroup, error: insertError } = await supabase
      .from('groups')
      .insert({
        name: name || `Grupo ${whatsapp_id}`,
        current_members: newCurrentMembers,
        total_entries: initialEntries,
        total_exits: initialExits,
        whatsapp_id,
        last_day_total_entries: 0, // Start fresh
        last_day_total_exits: 0,
        last_reset_date: today,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating group:', insertError)
      return { error: insertError }
    }

    console.log('Group created:', name || whatsapp_id)
    // Save initial history for new group
    if (newGroup) {
      await saveGroupHistory(supabase, newGroup.id, newCurrentMembers, initialEntries, initialExits)
    }
    return { success: true, action: 'created' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload = await req.json()
    console.log('Group webhook received:', JSON.stringify(payload))

    // Handle batch mode - multiple groups at once
    if (payload.batch && Array.isArray(payload.groups)) {
      console.log(`Processing batch of ${payload.groups.length} groups`)
      
      for (const group of payload.groups) {
        await processGroup(supabase, group)
      }

      return new Response(
        JSON.stringify({ success: true, message: `Batch processed: ${payload.groups.length} groups` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle single group mode
    const result = await processGroup(supabase, payload)
    
    if (result?.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to process group', details: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Group data processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
