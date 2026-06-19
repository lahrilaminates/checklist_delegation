import supabase from "../../SupabaseClient";

export const fetchUniqueDepartmentDataApi = async () => {
  try {
    console.log("🔍 Fetching unique departments from users table...");

    // Fetch all user_access values for active users
    const { data, error } = await supabase
      .from("users")
      .select("user_access")
      .eq("status", "active")
      .not("user_access", "is", null);

    if (error) throw error;

    const role = localStorage.getItem('role');
    const userAccess = localStorage.getItem('user_access');

    const allDepts = [];
    data.forEach(item => {
      if (item.user_access) {
        const depts = item.user_access.split(",").map(d => d.trim());
        depts.forEach(d => {
          if (d && !allDepts.some(existing => existing.toLowerCase() === d.toLowerCase())) {
            allDepts.push(d);
          }
        });
      }
    });
    let uniqueDepartments = allDepts.sort();

    // HODs should see all departments now per user request
    // if (role === 'HOD' && userAccess && userAccess !== 'all') {
    //   const allowedDepts = userAccess.split(',').map(d => d.trim().toLowerCase());
    //   uniqueDepartments = uniqueDepartments.filter(d => allowedDepts.includes(d.toLowerCase()));
    // }

    console.log("✅ Unique departments found:", uniqueDepartments);
    return uniqueDepartments;
  } catch (error) {
    console.error("❌ Error fetching departments from users table:", error);
    return [];
  }
};




export const fetchUniqueGivenByDataApi = async () => {
  try {
    console.log("🔍 API: Fetching 'Assign From' list from database...");

    const { data, error } = await supabase
      .from('assign_from')
      .select('*') // Fetch all to be safe and check column names
      .order('id', { ascending: true });

    if (error) {
      console.error("❌ API ERROR (assign_from):", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ API: 'assign_from' table is empty. Add names in Settings.");
      return [];
    }

    // Handle different possible column names (name, given_by, etc.)
    const extractedNames = data.map(item => {
      let val = item.name || item.given_by || item.value || (typeof item === 'string' ? item : null);

      // Patch: if the value is a JSON string (due to previous bug), parse it
      if (typeof val === 'string' && val.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(val);
          return parsed.given_by || parsed.name || val;
        } catch (e) {
          // Not valid JSON, keep as is
        }
      }
      return val;
    }).filter(val => val && val.toString().trim() !== "");

    // Get unique values and sort
    const uniqueNames = [...new Set(extractedNames)].sort();

    console.log("✅ API: Loaded Assigners:", uniqueNames);
    return uniqueNames;
  } catch (error) {
    console.error("❌ API: Unexpected failure fetching assigners:", error);
    return [];
  }
};

export const fetchUniqueDoerNameDataApi = async (department) => {
  try {
    console.log("🔍 Fetching doer data for department:", department);

    let query = supabase
      .from("users")
      .select("user_name, user_access, status, leave_date, leave_end_date, reported_by, can_self_assign")
      .order("user_name", { ascending: true });

    if (department) {
      // Fetch users where user_access matches or contains the department
      query = query.ilike("user_access", `%${department}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error when fetching user data", error);
      return [];
    }

    const role = (localStorage.getItem('role') || "").toUpperCase();
    const username = (localStorage.getItem('user-name') || "").toLowerCase();

    // Filter unique by user_name just in case there are duplicates
    const uniqueUsers = [];
    const seenNames = new Set();

    data?.forEach(user => {
      const uName = (user.user_name || "").toLowerCase();
      if (uName && !seenNames.has(uName)) {
        // Apply HOD filtering: only show themselves or their reports
        if (role === 'HOD' && username) {
          const reportedBy = (user.reported_by || "").toLowerCase();
          if (reportedBy !== username && uName !== username) {
            return;
          }

          // If it's the HOD themselves, check if they have self-assign rights
          if (uName === username && !user.can_self_assign) {
            return;
          }
        }

        uniqueUsers.push({
          user_name: user.user_name,
          status: user.status,
          leave_date: user.leave_date,
          leave_end_date: user.leave_end_date,
          reported_by: user.reported_by,
          can_self_assign: user.can_self_assign
        });
        seenNames.add(uName);
      }
    });

    return uniqueUsers;
  } catch (error) {
    console.error("❌ Error from Supabase:", error);
    return [];
  }
};



export const pushAssignTaskApi = async (generatedTasks, targetTable = null) => {
  // If targetTable is explicitly provided, use it for all tasks (legacy behavior or forced override)
  if (targetTable) {
    const tasksData = generatedTasks.map((task) => ({
      department: task.department,
      given_by: task.givenBy,
      name: task.doer,
      task_description: task.task_description || task.description || null, // Support both naming conventions
      // task_start_date and planned_date are the same — both use the specific occurrence date (dueDate)
      task_start_date: task.dueDate,
      planned_date: task.dueDate,
      frequency: task.frequency,
      duration: task.duration || null,
      enable_reminder: task.enableReminders ? "yes" : "no",
      require_attachment: task.requireAttachment ? "yes" : "no",
      audio_url: task.audio_url || null,
      instruction_attachment_url: task.instruction_attachment_url || null,
      instruction_attachment_type: task.instruction_attachment_type || null,
      status: targetTable === 'checklist' ? null : (task.status || 'pending')
    }));

    try {
      const { data, error } = await supabase.from(targetTable).insert(tasksData).select();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error when posting data to ${targetTable}:`, error);
      throw error;
    }
  }

  // Otherwise, separate tasks by frequency and route to respective tables
  const delegationTasks = [];
  const checklistTasks = [];

  generatedTasks.forEach(task => {
    const freq = task.frequency?.toLowerCase() || "";
    const isOneTime = freq === "one-time" ||
      freq.includes("one time") ||
      freq.includes("no recurrence");

    const taskData = {
      department: task.department,
      given_by: task.givenBy,
      name: task.doer,
      task_description: task.task_description || task.description || null, // Support both naming conventions
      // task_start_date and planned_date are the same — both use the specific occurrence date (dueDate)
      task_start_date: task.dueDate,
      planned_date: task.dueDate,
      frequency: task.frequency,
      duration: task.duration || null,
      enable_reminder: task.enableReminders ? "yes" : "no",
      require_attachment: task.requireAttachment ? "yes" : "no",
      audio_url: task.audio_url || null,
      instruction_attachment_url: task.instruction_attachment_url || null,
      instruction_attachment_type: task.instruction_attachment_type || null,
    };

    if (isOneTime) {
      delegationTasks.push({ ...taskData, status: task.status || 'pending' });
    } else {
      checklistTasks.push({ ...taskData, status: null });
    }
  });

  const results = [];

  try {
    if (delegationTasks.length > 0) {
      const { data, error } = await supabase.from('delegation').insert(delegationTasks).select();
      if (error) {
        console.error("Error inserting into delegation table:", error);
        throw error;
      }
      if (data) results.push(...data);
    }

    if (checklistTasks.length > 0) {
      const { data, error } = await supabase.from('checklist').insert(checklistTasks).select();
      if (error) {
        console.error("Error inserting into checklist table:", error);
        throw error;
      }
      if (data) results.push(...data);
    }

    console.log("Tasks distributed successfully. Results:", results);
    return results;
  } catch (error) {
    console.error("Error during distributed task assignment:", error);
    throw error;
  }
};


