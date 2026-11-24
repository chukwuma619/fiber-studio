import {
  ArrowLeftRight,
  Home,
  Settings,
  Banknote,
  Globe,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export type NavItemId =
  | "home"
  | "assets"
  | "payments"
  | "channels"
  | "network"
  | "settings"

export type NavItem = {
  id: NavItemId
  label: string
  href: string
  description: string
  icon: LucideIcon
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: Home,
    description: "Your Fiber balance, on-chain CKB, and recent payments.",
  },
  {
    id: "payments",
    label: "Payments",
    href: "/payments",
    icon: Banknote,
    description: "Send payments, create invoices, and view payment history.",
  },
  {
    id: "assets",
    label: "Assets",
    href: "/assets",
    icon: Wallet,
    description: "View CKB and UDT balances on-chain and in Fiber channels.",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Manage your node, wallet, and app preferences.",
  },
]

export const ADVANCED_NAV_ITEMS: NavItem[] = [
  {
    id: "channels",
    label: "Channels",
    href: "/channels",
    icon: ArrowLeftRight,
    description: "Open, monitor, and manage your payment channels.",
  },
  {
    id: "network",
    label: "Network",
    href: "/network",
    icon: Globe,
    description: "Manage saved peers, connections, and your channel neighborhood.",
  },
]

export const NAV_ITEMS: NavItem[] = [...PRIMARY_NAV_ITEMS, ...ADVANCED_NAV_ITEMS]

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getNavItemById(id: NavItemId): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.id === id)
  if (!item) {
    throw new Error(`Unknown nav item: ${id}`)
  }
  return item
}
