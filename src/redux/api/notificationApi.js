import supabase from "../../SupabaseClient";

export const fetchNotificationsApi = async (role, userId) => {
  try {
    const roleLower = role.toLowerCase();
    
    // 1. Fetch relevant notifications
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    // Hierarchy filter
    if (roleLower !== "admin" && localStorage.getItem("user-name")?.toLowerCase() !== "admin") {
      query = query.in("role_target", ["all", roleLower]);
    }

    const { data: notifications, error: nError } = await query;
    if (nError) throw nError;
    if (!notifications || notifications.length === 0) return [];

    // 2. Fetch read status for this user
    let readStatuses = {};
    if (userId) {
      const { data: readData } = await supabase
        .from("user_notifications")
        .select("notification_id, is_read")
        .eq("user_id", userId);
      
      if (readData) {
        readStatuses = readData.reduce((acc, row) => {
          acc[row.notification_id] = row.is_read;
          return acc;
        }, {});
      }
    }

    // 3. Fetch unique creators
    const creatorIds = [...new Set(notifications.map(n => n.created_by).filter(id => id))];
    let creatorsMap = {};
    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, user_name, profile_image")
        .in("id", creatorIds);
      
      if (users) {
        creatorsMap = users.reduce((acc, user) => {
          acc[String(user.id)] = user;
          return acc;
        }, {});
      }
    }

    // 4. Map everything
    return notifications.map(n => ({
      ...n,
      isRead: !!readStatuses[n.id],
      creator: creatorsMap[String(n.created_by)] || null
    }));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
};

export const markAsReadApi = async (notificationId, userId) => {
  try {
    const { error } = await supabase
      .from("user_notifications")
      .upsert({
        user_id: parseInt(userId),
        notification_id: notificationId,
        is_read: true
      }, { onConflict: 'user_id, notification_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error marking as read:", error);
    throw error;
  }
};

export const createNotificationApi = async (notificationData) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          title: notificationData.title,
          message: notificationData.message,
          role_target: notificationData.roleTarget || "all",
          created_by: notificationData.createdBy ? parseInt(notificationData.createdBy) : null,
        },
      ])
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

export const deleteNotificationApi = async (id) => {
  try {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};
