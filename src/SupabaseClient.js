

// import { createClient } from "@supabase/supabase-js";

// const supabaseURL =import.meta.env.VITE_SUPABASE_URL
// const supabaseKey=import.meta.env.VITE_SUPABASE_ANON_KEY 
// const supabase =  createClient(supabaseURL,supabaseKey)    

// export default supabase;



import { createClient } from "@supabase/supabase-js";

const supabaseURL = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseURL, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export default supabase;




// import { createClient } from "@supabase/supabase-js";

// const supabaseURL = import.meta.env.VITE_SUPABASE_URL;
// const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY; // service_role
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY; // anon

// const supabase = createClient(
//   supabaseURL,
//   import.meta.env.DEV ? supabaseServiceKey : supabaseAnonKey, // 👈 use service locally, anon on live
//   { realtime: { params: { eventsPerSecond: 10 } } }
// );

// export default supabase;
