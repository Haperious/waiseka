export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A1A0F] px-4">
      {children}
    </div>
  )
}
