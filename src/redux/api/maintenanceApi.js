import supabase from "../../SupabaseClient";

// Helper to parse JSON strings if accidentally stored as such
const parseJsonIfNeeded = (val) => {
    if (typeof val === 'string' && val.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(val);
            return parsed.given_by || parsed.name || parsed.user_name || val;
        } catch (e) {
            return val;
        }
    }
    return val;
};

// Fetch Maintenance Tasks (Active/Pending)
export const fetchMaintenanceDataSortByDate = async (page = 1, limit = 50, searchTerm = '', frequency = '', dateFilter = 'all') => {
    const role = (localStorage.getItem('role') || "").toLowerCase();
    const username = localStorage.getItem('user-name');
    console.log(`DEBUG: fetchMaintenanceDataSortByDate - Role: ${role}, User: ${username}, Page: ${page}, Frequency: ${frequency}`);

    try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Query without strict date filtering for debugging
        let query = supabase
            .from('maintenance_tasks')
            .select('*', { count: 'exact' })
            .is("submission_date", null)
            .order('planned_date', { ascending: true })
            .range(from, to);

        if (frequency) {
            query = query.eq('freq', frequency);
        }

        if (searchTerm && searchTerm.trim() !== '') {
            const searchValue = searchTerm.trim();
            query = query.or(`name.ilike.%${searchValue}%,given_by.ilike.%${searchValue}%,department.ilike.%${searchValue}%,machine_name.ilike.%${searchValue}%,part_name.ilike.%${searchValue}%,part_area.ilike.%${searchValue}%,task_description.ilike.%${searchValue}%`);
        }

        if (role === 'hod' && username) {
            const { data: reports } = await supabase
                .from("users")
                .select("user_name")
                .eq("reported_by", username);
            const reportingUsers = [username, ...(reports?.map(r => r.user_name) || [])];
            query = query.in('name', reportingUsers);
        } else if (role === 'user' && username) {
            console.log(`DEBUG: Applying user filter for ${username}`);
            query = query.eq('name', username);
        }

        // Apply Date Filter
        const formatLocalISO = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const mm = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const todayStartStr = formatLocalISO(today);
        const todayEndStr = formatLocalISO(todayEnd);

        if (dateFilter === 'today') {
            query = query.gte('planned_date', todayStartStr).lte('planned_date', todayEndStr);
        } else if (dateFilter === 'overdue') {
            query = query.lt('planned_date', todayStartStr);
        } else if (dateFilter === 'upcoming') {
            query = query.gt('planned_date', todayEndStr);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error("DEBUG: Error in fetchMaintenanceDataSortByDate:", error);
            return { data: [], totalCount: 0 };
        }

        console.log(`DEBUG: fetchMaintenanceDataSortByDate Result: ${data?.length || 0} pending tasks found. Total count: ${count}`);

        const cleanedData = (data || []).map(row => ({
            ...row,
            given_by: parseJsonIfNeeded(row.given_by),
            name: parseJsonIfNeeded(row.name)
        }));

        return { data: cleanedData, totalCount: count };

    } catch (error) {
        console.error("DEBUG: Catch Error in fetchMaintenanceDataSortByDate", error);
        return { data: [], totalCount: 0 };
    }
};

// Fetch Maintenance History (Completed)
export const fetchMaintenanceDataForHistory = async (page = 1, searchTerm = '') => {
    const itemsPerPage = 50;
    const start = (page - 1) * itemsPerPage;
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('user-name');
    const userAccess = localStorage.getItem('user_access');

    try {
        let query = supabase
            .from('maintenance_tasks')
            .select('*', { count: 'exact' })
            .order('task_start_date', { ascending: false })
            .not('submission_date', 'is', null)
        // .not('status', 'is', null)
        // .range(start, start + itemsPerPage - 1);

        console.log(`Fetching Maintenance History: Page ${page}, Role: ${role}, User: ${username}`);

        if (searchTerm && searchTerm.trim() !== '') {
            const searchValue = searchTerm.trim();
            query = query.or(`name.ilike.%${searchValue}%,given_by.ilike.%${searchValue}%,department.ilike.%${searchValue}%,machine_name.ilike.%${searchValue}%,part_name.ilike.%${searchValue}%,part_area.ilike.%${searchValue}%,task_description.ilike.%${searchValue}%`);
        }

        if (role === 'HOD' && username) {
            const { data: reports } = await supabase
                .from("users")
                .select("user_name")
                .eq("reported_by", username);
            const reportingUsers = [username, ...(reports?.map(r => r.user_name) || [])];
            query = query.in('name', reportingUsers);
        } else if (role === 'user' && username) {
            query = query.eq('name', username);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching maintenance history:", error);
            return [];
        }

        const cleanedData = (data || []).map(row => ({
            ...row,
            given_by: parseJsonIfNeeded(row.given_by),
            name: parseJsonIfNeeded(row.name)
        }));

        return cleanedData;

    } catch (error) {
        console.log("Error from Supabase", error);
        return [];
    }
};

// Fetch ALL Maintenance Tasks (Both Pending and Completed) for Dashboard
export const fetchAllMaintenanceTasksForDashboard = async (page = 1, limit = 1000) => {
    const role = (localStorage.getItem('role') || "").toLowerCase();
    const username = localStorage.getItem('user-name');
    console.log(`DEBUG: fetchAllMaintenanceTasksForDashboard - Role: ${role}, User: ${username}`);

    try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Query to fetch ALL maintenance tasks (no submission_date filter)
        let query = supabase
            .from('maintenance_tasks')
            .select('*', { count: 'exact' })
            .order('task_start_date', { ascending: false })
            .range(from, to);

        // Apply role-based filtering
        if (role === 'user' && username) {
            console.log(`DEBUG: Applying user filter for ${username}`);
            query = query.eq('name', username);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error("DEBUG: Error in fetchAllMaintenanceTasksForDashboard:", error);
            return { data: [], totalCount: 0 };
        }

        console.log(`DEBUG: fetchAllMaintenanceTasksForDashboard Result: ${data?.length || 0} tasks found. Total count: ${count}`);
        if (data?.length > 0) {
            console.log("DEBUG: Sample Task IDs:", data.slice(0, 3).map(t => t.id));
        }

        const cleanedData = (data || []).map(row => ({
            ...row,
            given_by: parseJsonIfNeeded(row.given_by),
            name: parseJsonIfNeeded(row.name)
        }));

        return { data: cleanedData, totalCount: count };

    } catch (error) {
        console.error("DEBUG: Catch Error in fetchAllMaintenanceTasksForDashboard", error);
        return { data: [], totalCount: 0 };
    }
};

// Update Maintenance Tasks
export const updateMaintenanceData = async (submissionData) => {
    try {
        if (!Array.isArray(submissionData) || submissionData.length === 0) {
            throw new Error('Invalid submission data');
        }

        const updates = await Promise.all(submissionData.map(async (item) => {
            let imageUrl = null;

            if (item.image && item.image.previewUrl) {
                try {
                    const response = await fetch(item.image.previewUrl);
                    const blob = await response.blob();
                    const file = new File([blob], item.image.name, { type: item.image.type });
                    const fileExt = item.image.name.split('.').pop();
                    const fileName = `mnt_${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage.from('maintenance').upload(fileName, file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage.from('maintenance').getPublicUrl(fileName);
                    imageUrl = publicUrl;

                } catch (uploadError) {
                    console.error("Image upload failed", uploadError);
                    throw uploadError;
                }
            }

            return {
                id: item.taskId,
                status: item.status, // 'Done' or 'Issue'
                remarks: item.remarks, // Note: Schema might be 'remarks' or 'remark' - check assumption. Schema likely 'remarks' if copied from checklist pattern, or check previous code.
                submission_date: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30'),
                uploaded_image_url: imageUrl,
                admin_done: false // Reset/Set to false when user submits maintenance task
            };
        }));

        const { data, error } = await supabase
            .from('maintenance_tasks')
            .upsert(updates, { onConflict: ['id'] });

        if (error) throw error;
        return data;

    } catch (error) {
        console.error('Error in updateMaintenanceData:', error);
        throw error;
    }
};

export const postMaintenanceTaskApi = async (taskData) => {
    try {
        console.log("Attempting to insert maintenance task:", taskData);
        // Map any description/audio fields if they come from UI in different names
        const payload = Array.isArray(taskData)
            ? taskData.map(t => {
                const { instruction_attachment_type, instruction_attachment_url, ...rest } = t;
                return { ...rest, audio_url: rest.audio_url || null };
            })
            : Object.fromEntries(
                Object.entries({ ...taskData, audio_url: taskData.audio_url || null })
                    .filter(([key]) => key !== 'instruction_attachment_type' && key !== 'instruction_attachment_url')
            );

        const { data, error } = await supabase
            .from('maintenance_tasks')
            .insert(payload)
            .select();

        if (error) {
            console.error("Error creating maintenance task:", error);
            console.error("Error details:", error.message, error.details, error.hint);
            throw error;
        }
        console.log("Successfully created maintenance task:", data);
        return data;
    } catch (error) {
        console.error("Exception in postMaintenanceTaskApi:", error);
        throw error;
    }
};

export const updateMaintenanceTaskApi = async (updatedTask, originalTask) => {
    try {
        let query = supabase.from("maintenance_tasks").update({
            machine_name: updatedTask.machine_name,
            part_name: updatedTask.part_name,
            part_area: updatedTask.part_area,
            given_by: updatedTask.given_by,
            name: updatedTask.name,
            task_description: updatedTask.task_description,
            audio_url: updatedTask.audio_url,
            freq: updatedTask.freq,
            duration: updatedTask.duration || null,
            status: updatedTask.status,
            remarks: updatedTask.remarks
        });

        if (originalTask) {
            // Update all matching pending tasks
            query = query
                .eq("machine_name", originalTask.machine_name)
                .eq("part_name", originalTask.part_name)
                .eq("part_area", originalTask.part_area)
                .eq("task_description", originalTask.task_description)
                .eq("name", originalTask.name)
                .is("submission_date", null);
        } else {
            // Fallback to single record update
            query = query.eq("id", updatedTask.id);
        }

        const { data, error } = await query.is("submission_date", null).select();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("API Error updating maintenance task:", error);
        throw error;
    }
};

export const deleteMaintenanceTasksApi = async (tasks) => {
    try {
        for (const task of tasks) {
            const { error } = await supabase
                .from('maintenance_tasks')
                .delete()
                .eq("machine_name", task.machine_name)
                .eq("part_name", task.part_name)
                .eq("part_area", task.part_area)
                .eq("task_description", task.task_description)
                .eq("name", task.name)
                .eq("freq", task.freq)
                .eq("given_by", task.given_by)
                .is("submission_date", null);

            if (error) throw error;
        }
        return tasks.map(t => t.id || t.taskId);
    } catch (error) {
        console.error("Error deleting maintenance tasks:", error);
        throw error;
    }
};

export const fetchPendingMaintenanceApprovals = async () => {
    try {
        const { data, error } = await supabase
            .from('maintenance_tasks')
            .select('*')
            .not('submission_date', 'is', null) // Tasks that are submitted
            .or('admin_done.is.null,admin_done.eq.false') // Not yet admin approved
            .order('submission_date', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching pending maintenance approvals:", error);
        return [];
    }
};

export const approveMaintenanceTask = async (id) => {
    try {
        const username = localStorage.getItem("user-name") || "Admin";
        const now = new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30');
        const { data, error } = await supabase
            .from('maintenance_tasks')
            .update({
                admin_done: true,
                admin_approval_date: now,
                admin_approved_by: username
            })
            .eq('id', id)
            .select() // .single may fail if no row found but here we have ID
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error approving maintenance task:", error);
        throw error;
    }
};

export const rejectMaintenanceTask = async (id, reason) => {
    try {
        const { data, error } = await supabase
            .from('maintenance_tasks')
            .update({
                admin_done: false,
                submission_date: null,
                // status: 'Pending', // Optional: reset status
                uploaded_image_url: null, // Clear proof so they re-upload
                remarks: reason // Set remarks to rejection reason? Or keep separate field?
            })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error rejecting maintenance task:", error);
        throw error;
    }
};

export const fetchApprovedMaintenance = async () => {
    try {
        const { data, error } = await supabase
            .from('maintenance_tasks')
            .select('*')
            .eq('admin_done', true)
            .order('submission_date', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching approved maintenance tasks:", error);
        return [];
    } 
};
