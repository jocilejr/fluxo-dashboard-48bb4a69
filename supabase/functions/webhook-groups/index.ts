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
  entriesDiff: number,
  exitsDiff: number
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
    // Update existing history
    const { error } = await supabase
      .from('group_statistics_history')
      .update({
        entries: (existingHistory.entries || 0) + Math.max(0, entriesDiff),
        exits: (existingHistory.exits || 0) + Math.max(0, exitsDiff),
        current_members: currentMembers,
      })
      .eq('id', existingHistory.id)

    if (error) {
      console.error('Error updating history:', error)
    } else {
      console.log('History updated for group:', groupId)
    }
  } else {
    // Create new history record
    const { error } = await supabase
      .from('group_statistics_history')
      .insert({
        group_id: groupId,
        date: today,
        entries: Math.max(0, entriesDiff),
        exits: Math.max(0, exitsDiff),
        current_members: currentMembers,
      })

    if (error) {
      console.error('Error creating history:', error)
    } else {
      console.log('History created for group:', groupId)
    }
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
        const { whatsapp_id, name, current_members, entries, exits } = group

        if (!name && !whatsapp_id) {
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
        
        if (!existingGroup && name) {
          const { data } = await supabase
            .from('groups')
            .select('*')
            .eq('name', name)
            .single()
          existingGroup = data
        }

        if (existingGroup) {
          // Calculate differences for history
          const entriesDiff = (entries ?? 0) - (existingGroup.total_entries ?? 0)
          const exitsDiff = (exits ?? 0) - (existingGroup.total_exits ?? 0)
          const newCurrentMembers = current_members ?? existingGroup.current_members

          // Update existing group
          const { error: updateError } = await supabase
            .from('groups')
            .update({
              name: name || existingGroup.name,
              current_members: newCurrentMembers,
              total_entries: entries ?? existingGroup.total_entries,
              total_exits: exits ?? existingGroup.total_exits,
              whatsapp_id: whatsapp_id || existingGroup.whatsapp_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingGroup.id)

          if (updateError) {
            console.error('Error updating group:', updateError)
          } else {
            console.log('Group updated:', name || whatsapp_id)
            // Save history after successful update
            await saveGroupHistory(supabase, existingGroup.id, newCurrentMembers, entriesDiff, exitsDiff)
          }
        } else {
          // Create new group
          const newCurrentMembers = current_members || 0
          const { data: newGroup, error: insertError } = await supabase
            .from('groups')
            .insert({
              name: name || `Grupo ${whatsapp_id}`,
              current_members: newCurrentMembers,
              total_entries: entries || 0,
              total_exits: exits || 0,
              whatsapp_id,
            })
            .select()
            .single()

          if (insertError) {
            console.error('Error creating group:', insertError)
          } else {
            console.log('Group created:', name || whatsapp_id)
            // Save initial history for new group
            if (newGroup) {
              await saveGroupHistory(supabase, newGroup.id, newCurrentMembers, entries || 0, exits || 0)
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: `Batch processed: ${payload.groups.length} groups` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle single group mode
    const { whatsapp_id, name, current_members, entries, exits } = payload

    if (!name && !whatsapp_id) {
      return new Response(
        JSON.stringify({ error: 'name or whatsapp_id is required' }),
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
    
    if (!existingGroup && name) {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('name', name)
        .single()
      existingGroup = data
    }

    if (existingGroup) {
      // Calculate differences for history
      const entriesDiff = (entries ?? 0) - (existingGroup.total_entries ?? 0)
      const exitsDiff = (exits ?? 0) - (existingGroup.total_exits ?? 0)
      const newCurrentMembers = current_members ?? existingGroup.current_members

      // Update existing group
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          name: name || existingGroup.name,
          current_members: newCurrentMembers,
          total_entries: entries ?? existingGroup.total_entries,
          total_exits: exits ?? existingGroup.total_exits,
          whatsapp_id: whatsapp_id || existingGroup.whatsapp_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingGroup.id)

      if (updateError) {
        console.error('Error updating group:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update group', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Group updated successfully:', name || whatsapp_id)
      // Save history after successful update
      await saveGroupHistory(supabase, existingGroup.id, newCurrentMembers, entriesDiff, exitsDiff)
    } else {
      // Create new group
      const newCurrentMembers = current_members || 0
      const { data: newGroup, error: insertError } = await supabase
        .from('groups')
        .insert({
          name: name || `Grupo ${whatsapp_id}`,
          current_members: newCurrentMembers,
          total_entries: entries || 0,
          total_exits: exits || 0,
          whatsapp_id,
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

      console.log('Group created successfully:', name || whatsapp_id)
      // Save initial history for new group
      if (newGroup) {
        await saveGroupHistory(supabase, newGroup.id, newCurrentMembers, entries || 0, exits || 0)
      }
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
