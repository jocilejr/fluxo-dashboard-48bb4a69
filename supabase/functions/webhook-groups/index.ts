import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get Brazil date for history logging
    const getBrazilDate = () => {
      const now = new Date()
      const brazilOffset = -3 * 60 // UTC-3 in minutes
      const brazilTime = new Date(now.getTime() + brazilOffset * 60000)
      return brazilTime.toISOString().split('T')[0]
    }

    // Handle batch mode - multiple groups at once
    if (payload.batch && Array.isArray(payload.groups)) {
      console.log(`Processing batch of ${payload.groups.length} groups`)
      const today = getBrazilDate()
      
      for (const group of payload.groups) {
        const { 
          whatsapp_id, 
          group_name, 
          batch_number, 
          participants, 
          whatsapp_url, 
          active_link, 
          entries, 
          exits 
        } = group

        if (!group_name && !whatsapp_id) {
          console.log('Skipping group without name or whatsapp_id')
          continue
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
        
        if (!existingGroup && group_name) {
          const { data } = await supabase
            .from('groups')
            .select('*')
            .eq('name', group_name)
            .single()
          existingGroup = data
        }

        if (existingGroup) {
          // Update existing group
          const { error: updateError } = await supabase
            .from('groups')
            .update({
              name: group_name || existingGroup.name,
              current_members: participants ?? existingGroup.current_members,
              total_entries: entries ?? existingGroup.total_entries,
              total_exits: exits ?? existingGroup.total_exits,
              whatsapp_id: whatsapp_id || existingGroup.whatsapp_id,
              batch_number: batch_number ?? existingGroup.batch_number,
              whatsapp_url: whatsapp_url || existingGroup.whatsapp_url,
              active_link: active_link !== undefined ? active_link : existingGroup.active_link,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingGroup.id)

          if (updateError) {
            console.error('Error updating group:', updateError)
          } else {
            console.log('Group updated:', group_name || whatsapp_id)
            
            // Upsert daily history
            await upsertDailyHistory(supabase, existingGroup.id, today, entries || 0, exits || 0, participants ?? existingGroup.current_members)
          }
        } else {
          // Create new group
          const { data: newGroup, error: insertError } = await supabase
            .from('groups')
            .insert({
              name: group_name || `Grupo ${whatsapp_id}`,
              current_members: participants || 0,
              total_entries: entries || 0,
              total_exits: exits || 0,
              whatsapp_id,
              batch_number: batch_number || 0,
              whatsapp_url,
              active_link,
            })
            .select()
            .single()

          if (insertError) {
            console.error('Error creating group:', insertError)
          } else {
            console.log('Group created:', group_name || whatsapp_id)
            
            // Create initial history entry
            if (newGroup) {
              await upsertDailyHistory(supabase, newGroup.id, today, entries || 0, exits || 0, participants || 0)
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: `Batch processed: ${payload.groups.length} groups` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle single group mode (legacy support)
    const { group_name, event_type, current_members, entries, exits, whatsapp_id, batch_number, whatsapp_url, active_link } = payload

    if (!group_name && !whatsapp_id) {
      return new Response(
        JSON.stringify({ error: 'group_name or whatsapp_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find existing group
    let existingGroup = null
    
    if (whatsapp_id) {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('whatsapp_id', whatsapp_id)
        .single()
      existingGroup = data
    }
    
    if (!existingGroup && group_name) {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('name', group_name)
        .single()
      existingGroup = data
    }

    const today = getBrazilDate()

    if (existingGroup) {
      // Update existing group
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }

      // Update new fields if provided
      if (whatsapp_id) updateData.whatsapp_id = whatsapp_id
      if (batch_number !== undefined) updateData.batch_number = batch_number
      if (whatsapp_url) updateData.whatsapp_url = whatsapp_url
      if (active_link !== undefined) updateData.active_link = active_link

      // If entries/exits/current_members are provided as numbers, SET them directly (replace)
      if (entries !== undefined) {
        updateData.total_entries = entries
      }

      if (exits !== undefined) {
        updateData.total_exits = exits
      }

      if (current_members !== undefined) {
        updateData.current_members = current_members
      }

      // event_type "entry" or "exit" increments/decrements by 1
      if (event_type === 'entry') {
        updateData.total_entries = (existingGroup.total_entries || 0) + 1
        updateData.current_members = (existingGroup.current_members || 0) + 1
      }

      if (event_type === 'exit') {
        updateData.total_exits = (existingGroup.total_exits || 0) + 1
        updateData.current_members = Math.max(0, (existingGroup.current_members || 0) - 1)
      }

      const { error: updateError } = await supabase
        .from('groups')
        .update(updateData)
        .eq('id', existingGroup.id)

      if (updateError) {
        console.error('Error updating group:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update group', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Log daily statistics history
      const dailyEntries = entries !== undefined ? entries : (event_type === 'entry' ? 1 : 0)
      const dailyExits = exits !== undefined ? exits : (event_type === 'exit' ? 1 : 0)
      const finalMembers = updateData.current_members ?? existingGroup.current_members

      await upsertDailyHistory(supabase, existingGroup.id, today, dailyEntries, dailyExits, finalMembers, event_type)

      console.log('Group updated successfully:', group_name || whatsapp_id)
    } else {
      // Create new group
      const { data: newGroup, error: insertError } = await supabase
        .from('groups')
        .insert({
          name: group_name || `Grupo ${whatsapp_id}`,
          current_members: current_members || 0,
          total_entries: entries || 0,
          total_exits: exits || 0,
          whatsapp_id,
          batch_number: batch_number || 0,
          whatsapp_url,
          active_link,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating group:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to create group', details: insertError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create initial history entry
      if (newGroup) {
        await supabase
          .from('group_statistics_history')
          .insert({
            group_id: newGroup.id,
            date: today,
            entries: entries || 0,
            exits: exits || 0,
            current_members: current_members || 0,
          })
      }

      console.log('Group created successfully:', group_name || whatsapp_id)
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

// Helper function to upsert daily history
async function upsertDailyHistory(
  supabase: any, 
  groupId: string, 
  date: string, 
  entries: number, 
  exits: number, 
  currentMembers: number,
  eventType?: string
) {
  const { data: existingHistory } = await supabase
    .from('group_statistics_history')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', date)
    .single()

  if (existingHistory) {
    // For event-based updates, accumulate. For batch updates, replace.
    const newEntries = eventType === 'entry' 
      ? existingHistory.entries + 1 
      : (eventType ? existingHistory.entries : entries)
    const newExits = eventType === 'exit' 
      ? existingHistory.exits + 1 
      : (eventType ? existingHistory.exits : exits)

    await supabase
      .from('group_statistics_history')
      .update({
        entries: newEntries,
        exits: newExits,
        current_members: currentMembers,
      })
      .eq('id', existingHistory.id)
  } else {
    await supabase
      .from('group_statistics_history')
      .insert({
        group_id: groupId,
        date: date,
        entries: entries,
        exits: exits,
        current_members: currentMembers,
      })
  }
}
