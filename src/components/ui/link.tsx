import * as Headless from '@headlessui/react'
import { createLink } from '@tanstack/react-router'
import React, { forwardRef } from 'react'

function isExternalHref(href: string) {
  return /^(?:[a-z][a-z\d+\-.]*:|\/\/|#)/i.test(href)
}

const LinkComponent = forwardRef(function LinkComponent(
  props: React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  return (
    <Headless.DataInteractive>
      <a {...props} ref={ref} />
    </Headless.DataInteractive>
  )
})

const RouterLink = createLink(LinkComponent)

type LinkProps = { href: string } & Omit<React.ComponentPropsWithoutRef<'a'>, 'href'>

export const Link = forwardRef(function Link(
  { href, ...props }: LinkProps,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  if (isExternalHref(href)) {
    return <LinkComponent href={href} {...props} ref={ref} />
  }

  return <RouterLink to={href} preload="intent" {...props} ref={ref} />
})
