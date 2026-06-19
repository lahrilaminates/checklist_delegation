// delegationApiSlice.js
import { createAsyncThunk } from '@reduxjs/toolkit';
import supabase from '../../SupabaseClient';

export const insertDelegationDoneAndUpdate = createAsyncThunk(
  'delegation/insertDelegationDoneAndUpdate',
  async ({ selectedDataArray, uploadedImages }, { rejectWithValue }) => {
    try {
      console.log('Processing submission:', { selectedDataArray, uploadedImages });

      const results = [];

      for (const taskData of selectedDataArray) {
        try {
          // Step 1: Insert into delegation_done table
          const delegationDoneData = {
            task_id: taskData.id || taskData.task_id,
            status: String(taskData.status).toLowerCase() === 'done' ? 'pending' : taskData.status,
            next_extend_date: taskData.next_extend_date || null,
            reason: taskData.reason || '',
            name: taskData.name,
            task_description: taskData.task_description,
            given_by: taskData.given_by,
            duration: taskData.duration || '',
            image_url: taskData.image || taskData.image_url, // Reverted to image_url for delegation_done table
            audio_url: taskData.audio_url || null,
            admin_done: false,
          };

          console.log('Inserting into delegation_done:', delegationDoneData);

          const { data: doneDataList, error: doneError } = await supabase
            .from('delegation_done')
            .insert([delegationDoneData])
            .select();

          if (doneError) {
            console.error('Error inserting delegation_done:', doneError);
            throw doneError;
          }

          const doneData = doneDataList && doneDataList.length > 0 ? doneDataList[0] : null;
          console.log('Successfully inserted delegation_done:', doneData);

          // Step 2: Handle image upload if exists
          let imageUrl = taskData.image || taskData.image_url;
          const taskImage = uploadedImages[taskData.id];

          if (taskImage) {
            try {
              console.log('Uploading image for task:', taskData.id);

              // Create a unique filename
              const timestamp = Date.now();
              const fileName = `delegation_${taskData.id}_${timestamp}_${taskImage.name}`;

              // Upload to Supabase storage using 'checklist' bucket as 'delegation' bucket doesn't exist
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('checklist')
                .upload(fileName, taskImage);

              if (uploadError) {
                console.error('Image upload error:', uploadError);
              } else {
                // Get public URL from 'checklist' bucket
                const { data: { publicUrl } } = supabase.storage
                  .from('checklist')
                  .getPublicUrl(fileName);

                imageUrl = publicUrl;

                if (doneData) {
                  // Update delegation_done with correct column name (image_url)
                  const { error: updateImageError } = await supabase
                    .from('delegation_done')
                    .update({ image_url: imageUrl })
                    .eq('id', doneData.id);

                  if (updateImageError) {
                    console.error('Error updating image URL:', updateImageError);
                  }
                }

                console.log('Image uploaded successfully:', imageUrl);
              }
            } catch (imageError) {
              console.error('Image processing error:', imageError);
            }
          }

          // Step 3: Update delegation table based on status
          let delegationUpdate = {
            updated_at: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30'),
            submission_date: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30'),
            image: imageUrl, // Keep using 'image' for delegation table as requested
            remarks: taskData.reason
          };

          if (taskData.status === 'done') {
            delegationUpdate.status = 'done';
            delegationUpdate.admin_done = false;
          } else if (taskData.status === 'extend') {
            if (taskData.next_extend_date) {
              delegationUpdate.planned_date = new Date(taskData.next_extend_date).toISOString();
              delegationUpdate.task_start_date = delegationUpdate.planned_date;
              delegationUpdate.status = 'extend';
            }
          }

          console.log('Updating delegation table:', delegationUpdate);

          const { data: updateData, error: updateError } = await supabase
            .from('delegation')
            .update(delegationUpdate)
            .eq('task_id', taskData.id || taskData.task_id)
            .select()
            .maybeSingle();

          if (updateError) {
            console.error('Error updating delegation:', updateError);
            throw updateError;
          }

          results.push({ id: taskData.id, status: 'success', data: updateData, done_id: doneData?.id });
        } catch (taskError) {
          console.error(`Failed to process task ${taskData.id}:`, taskError);
          results.push({ id: taskData.id, status: 'error', error: taskError.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Overall error in insertDelegationDoneAndUpdate:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDelegationDataSortByDate = async () => {
  try {
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('user-name');
    const userAccess = localStorage.getItem('user_access');

    let query = supabase
      .from('delegation')
      .select('*')
      .or('submission_date.is.null,status.neq.done') // Fetch pending tasks (never submitted) OR tasks that are not 'done' (extended)
      .order('planned_date', { ascending: true });

    if (role === 'user' && username) {
      query = query.eq('name', username);
    } else if (role === 'HOD' && username) {
      const { data: reports } = await supabase
        .from("users")
        .select("user_name")
        .eq("reported_by", username);
      const reportingUsers = [username, ...(reports?.map(r => r.user_name) || [])];
      query = query.in('name', reportingUsers);
    } else if (role === 'admin' && userAccess && userAccess !== 'all') {
      const allowedDepartments = userAccess.split(',').map(dept => dept.trim()).filter(d => d && d !== 'all');
      if (allowedDepartments.length > 0) {
        query = query.in('department', allowedDepartments);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(row => ({ ...row, id: row.task_id }));
  } catch (error) {
    console.log("Error from Supabase fetchDelegationDataSortByDate", error);
    return [];
  }
};

export const fetchDelegation_DoneDataSortByDate = async () => {
  try {
    const { data, error } = await supabase
      .from('delegation_done')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const taskIds = data.map(d => d.task_id).filter(id => id);
    let taskDetails = [];
    if (taskIds.length > 0) {
      const { data: details } = await supabase
        .from('delegation')
        .select('*')
        .in('task_id', taskIds);
      taskDetails = details || [];
    }

    return data.map(doneItem => {
      const detail = taskDetails.find(t => t.task_id === doneItem.task_id) || {};
      return {
        ...detail,
        ...doneItem,
        done_id: doneItem.id,
        original_task_id: doneItem.task_id
      };
    });
  } catch (error) {
    console.log("Error from Supabase fetchDelegation_DoneDataSortByDate", error);
    return [];
  }
};

export const fetchDelegationData = fetchDelegationDataSortByDate;
export const fetchDelegationHistory = fetchDelegation_DoneDataSortByDate;

export const updateDelegationDoneStatus = createAsyncThunk(
  'delegation/updateDelegationDoneStatus',
  async ({ id, status, taskId }, { rejectWithValue }) => {
    try {
      const username = localStorage.getItem("user-name") || "Admin";
      const now = new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30');

      const { data: doneData, error: doneError } = await supabase
        .from('delegation_done')
        .update({
          status: 'done',
          admin_done: true,
          admin_approval_date: now,
          admin_approved_by: username
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (doneError) throw doneError;

      if (taskId) {
        await supabase
          .from('delegation')
          .update({
            admin_done: true,
            status: 'done',
            admin_approval_date: now,
            admin_approved_by: username
          })
          .eq('task_id', taskId);
      }

      return doneData;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPendingApprovals = async () => {
  try {
    const { data: doneData, error } = await supabase
      .from('delegation_done')
      .select('*')
      .in('status', ['pending', 'extend'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!doneData || doneData.length === 0) return [];

    const taskIds = doneData.map(d => d.task_id).filter(id => id);
    let taskDetails = [];
    if (taskIds.length > 0) {
      const { data: details } = await supabase
        .from('delegation')
        .select('*')
        .in('task_id', taskIds);
      taskDetails = details || [];
    }

    return doneData.map(doneItem => {
      const detail = taskDetails.find(t => t.task_id === doneItem.task_id);
      return {
        ...detail,
        ...doneItem,
        done_id: doneItem.id,
        original_task_id: doneItem.task_id
      };
    });
  } catch (error) {
    return [];
  }
};

export const rejectDelegationTask = async (id, taskId, reason) => {
  try {
    // 1. Mark delegation_done as rejected and save the reason
    await supabase
      .from('delegation_done')
      .update({ status: 'rejected', reason: reason })
      .eq('id', id);

    // 2. Reset delegation task to pending so user can see it again
    await supabase
      .from('delegation')
      .update({
        status: 'pending',
        submission_date: null,
        admin_done: false,
        remarks: reason
      })
      .eq('task_id', taskId);

    return { success: true };
  } catch (error) {
    console.error("Error rejecting delegation task:", error);
    throw error;
  }
};