import { NavLink } from 'react-router'
import { navItems } from './navItems'

/** Mobil alt menü (md altı). */
export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive ? 'text-blue-800' : 'text-slate-500'
            }`
          }
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
