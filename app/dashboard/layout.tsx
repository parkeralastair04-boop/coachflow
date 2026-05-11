import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    redirect("/login?next=/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <div className="bg-background min-h-full lg:flex">
      <Sidebar />
      <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-[15rem]">
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
