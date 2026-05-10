import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
