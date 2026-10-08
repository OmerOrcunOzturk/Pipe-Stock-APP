import { Outlet } from 'react-router'
import SignOutButton from '@/features/auth/components/SignOutButton'
import UserInfo from '@/features/auth/components/UserInfo'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
          <span className="text-base font-semibold text-blue-800">Boru Stok</span>
          <div className="ml-auto flex min-w-0 items-center gap-2 text-right">
            <UserInfo />
            <SignOutButton variant="icon" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 md:p-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
