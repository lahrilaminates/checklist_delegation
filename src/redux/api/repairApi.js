import supabase from "../../SupabaseClient";

// --- FETCH PENDING REPAIRS ---
export const fetchRepairDataSortByDate = async (page = 1, limit = 50, searchTerm = '') => {
    try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('repair_tasks')
            .select('*', { count: 'exact' })
            .eq('status', 'Pending') // Fetch only pending items
            .order('created_at', { ascending: false })
            .range(from, to);

        // Search logic updated for new columns
        if (searchTerm && searchTerm.trim() !== '') {
            const val = searchTerm.trim();
            // Using cast for integer id search if possible, or just focus on other fields
            query = query.or(`machine_name.ilike.%${val}%,issue_description.ilike.%${val}%,filled_by.ilike.%${val}%`);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return { data, totalCount: count };
    } catch (error) {
        console.error("Error fetching repair data:", error);
        return { data: [], totalCount: 0 };
    }
};


// --- FETCH ALL REPAIR TASKS (For Dashboard) ---
export const fetchAllRepairTasks = async (page = 1, limit = 1000) => {
    try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabase
            .from('repair_tasks')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { data, totalCount: count };
    } catch (error) {
        console.error("Error fetching all repair tasks:", error);
        return { data: [], totalCount: 0 };
    }
};

// --- CREATE NEW REPAIR REQUEST ---
export const postRepairTaskApi = async (formData) => {
    try {
        const { data, error } = await supabase
            .from('repair_tasks')
            .insert({
                filled_by: formData.filledBy,
                assigned_person: formData.assignedPerson,
                machine_name: formData.machineName,
                issue_description: formData.issueDetails,
                audio_url: formData.audio_url || null, // Added audio_url
                duration: formData.duration || null,
                attachment: formData.attachment || false,
                status: 'Pending'
            })
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error creating repair task:", error);
        throw error;
    }
};

export const updateRepairData = async (updates) => {
    try {
        const results = await Promise.all(updates.map(async (item) => {
            const { data, error } = await supabase
                .from('repair_tasks')
                .update({
                    // Fallback to 'Pending Approval' status until admin_done column is added
                    status: (item.status === 'Completed' || item.status === 'Done' || item.status === 'Issue' || item.status.includes('Completed')) ? 'Pending Approval' : item.status,
                    part_replaced: item.partReplaced || null,
                    bill_amount: item.billAmount || null,
                    remarks: item.remarks || null,
                    vendor_name: item.vendorName || null,
                    work_photo_url: item.workPhotoUrl || null,
                    bill_copy_url: item.billCopyUrl || null,
                    submission_date: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30'),
                })
                .eq('id', item.taskId)
                .select();

            if (error) throw error;
            return data[0];
        }));

        return results;
    } catch (error) {
        console.error("Error updating repair:", error);
        throw error;
    }
};

// Fetch Repair History
export const fetchRepairDataForHistory = async (page = 1, searchTerm = '') => {
    const itemsPerPage = 50;
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    try {
        let query = supabase
            .from('repair_tasks')
            .select('*', { count: 'exact' })
            .eq('status', 'Approved')
            .order('submission_date', { ascending: false })
            .range(from, to);

        if (searchTerm && searchTerm.trim() !== '') {
            const val = searchTerm.trim();
            query = query.or(`machine_name.ilike.%${val}%,issue_description.ilike.%${val}%,filled_by.ilike.%${val}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error fetching repair history:", e);
        return [];
    }
};

export const fetchPendingRepairApprovals = async () => {
    try {
        const { data, error } = await supabase
            .from('repair_tasks')
            .select('*')
            .eq('status', 'Pending Approval') // Fallback to status-based filtering
            .order('submission_date', { ascending: false });

        if (error) throw error;
        return (data || []).map(task => ({
            ...task,
            id: task.id,
            department: task.department || 'Repair',
            name: task.assigned_person || task.filled_by
        }));
    } catch (error) {
        console.error("Error fetching pending repair approvals:", error);
        return [];
    }
};

export const approveRepairTask = async (id) => {
    try {
        const username = localStorage.getItem("user-name") || "Admin";
        const now = new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30');
        const { data, error } = await supabase
            .from('repair_tasks')
            .update({
                status: 'Approved', // Just set status for now
                admin_approval_date: now,
                admin_approved_by: username
            })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error approving repair task:", error);
        throw error;
    }
};

export const rejectRepairTask = async (id, reason) => {
    try {
        const { data, error } = await supabase
            .from('repair_tasks')
            .update({
                status: 'Pending',
                submission_date: null,
                work_photo_url: null,
                bill_copy_url: null,
                remarks: reason
            })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error rejecting repair task:", error);
        throw error;
    }
};

export const fetchApprovedRepairs = async () => {
    try {
        const { data, error } = await supabase
            .from('repair_tasks')
            .select('*')
            .eq('status', 'Approved')
            .order('submission_date', { ascending: false });

        if (error) throw error;
        return (data || []).map(task => ({
            ...task,
            department: task.department || 'Repair'
        }));
    } catch (error) {
        console.error("Error fetching approved repair tasks:", error);
        return [];
    }
};
