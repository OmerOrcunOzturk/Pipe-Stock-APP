import { NavLink } from 'react-router'
import SignOutButton from '@/features/auth/components/SignOutButton'
import UserInfo from '@/features/auth/components/UserInfo'
import { navItems } from './navItems'

/** Masaüstü (md ve üzeri) sol menü. */
export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center border-b border-slate-200 px-5">
        <span className="text-lg font-semibold text-blue-800">Boru Stok</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-slate-200 p-3">
        <div className="px-3">
          <UserInfo />
        </div>
        <SignOutButton variant="link" />
      </div>
    </aside>
  )
}
