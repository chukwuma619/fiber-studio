'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { FiberMark } from '@/component/brand/FiberMark'
import { FiberStudioWordmark } from '@/component/brand/FiberStudioWordmark'
import { Button } from '@/component/ui/button'
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from '@/component/ui/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/component/ui/sidebar'
import { StackedLayout } from '@/component/ui/stacked-layout'
import { Text, TextLink } from '@/component/ui/text'

const nav = [
  { href: '/', label: 'Home' },
  { href: '/download', label: 'Download' },
  { href: '/get-started', label: 'Get started' },
  { href: '/faq', label: 'FAQ' },
] as const

const GITHUB_URL = 'https://github.com/chukwuma619/fiber-studio'
const RELEASES_URL = `${GITHUB_URL}/releases`

function BrandMark() {
  return (
    <span className="flex items-center gap-2 text-zinc-950 dark:text-white">
      <FiberMark className="h-5 w-auto" />
      <FiberStudioWordmark layout="inline" />
    </span>
  )
}

function isCurrent(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

function SiteNavbar() {
  const pathname = usePathname()

  return (
    <Navbar>
      <NavbarSection>
        <NavbarItem href="/">
          <BrandMark />
        </NavbarItem>
      </NavbarSection>
      <NavbarSpacer />
      <NavbarSection className="max-lg:hidden">
        {nav.map((item) => (
          <NavbarItem key={item.href} href={item.href} current={isCurrent(pathname, item.href)}>
            {item.label}
          </NavbarItem>
        ))}
        <NavbarItem href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </NavbarItem>
      </NavbarSection>
      <NavbarSection>
        <Button href="/download" color="dark/zinc">
          Download
        </Button>
      </NavbarSection>
    </Navbar>
  )
}

function SiteSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarSection>
          <SidebarItem href="/">
            <SidebarLabel>
              <BrandMark />
            </SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          {nav.map((item) => (
            <SidebarItem key={item.href} href={item.href} current={isCurrent(pathname, item.href)}>
              <SidebarLabel>{item.label}</SidebarLabel>
            </SidebarItem>
          ))}
          <SidebarItem href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <SidebarLabel>GitHub</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-16 flex flex-col gap-4 border-t border-zinc-950/10 pt-8 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
      <BrandMark />
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <TextLink href="/download">Download</TextLink>
        <TextLink href="/get-started">Get started</TextLink>
        <TextLink href="/faq">FAQ</TextLink>
        <TextLink href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
          Releases
        </TextLink>
        <TextLink href="https://www.fiber.world/docs" target="_blank" rel="noopener noreferrer">
          Fiber docs
        </TextLink>
      </div>
      <Text>Early development</Text>
    </footer>
  )
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <StackedLayout navbar={<SiteNavbar />} sidebar={<SiteSidebar />}>
      {children}
      <SiteFooter />
    </StackedLayout>
  )
}
