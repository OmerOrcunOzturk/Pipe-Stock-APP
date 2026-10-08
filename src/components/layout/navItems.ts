import {
  ArrowDownToLine,
  BarChart3,
  LayoutDashboard,
  Package,
  Settings2,
  Truck,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Menü öğeleri tek yerden yönetilir; hem sol menü hem alt menü bunu kullanır. */
export const navItems: NavItem[] = [
  { to: '/', label: 'Panel', icon: LayoutDashboard },
  { to: '/stok', label: 'Stok', icon: Package },
  { to: '/giris', label: 'Giriş', icon: ArrowDownToLine },
  { to: '/dagitim', label: 'Dağıtım', icon: Truck },
  { to: '/raporlar', label: 'Raporlar', icon: BarChart3 },
  { to: '/tanimlar', label: 'Tanımlar', icon: Settings2 },
]
