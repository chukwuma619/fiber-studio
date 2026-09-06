import type { PreflightReport, PreflightStatus } from "../../lib/fnn/preflight"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { HelpTooltip } from "../ui/help-tooltip"
import { Text } from "../ui/text"

type PaymentDiagnosticCardProps = {
  report: PreflightReport | null
  isLoading?: boolean
  compact?: boolean
  emptyHint?: string
}

export function PaymentDiagnosticCard({
  report,
  isLoading = false,
  compact = false,
  emptyHint = "Enter payment details to inspect the route",
}: PaymentDiagnosticCardProps) {
  const padding = compact ? "px-3 py-2.5" : "px-4 py-3"

  if (isLoading) {
    return (
      <div className={`rounded-lg bg-zinc-50 dark:bg-zinc-800/50 ${padding}`}>
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          Checking route…
        </Text>
      </div>
    )
  }

  if (!report) {
    return (
      <div className={`rounded-lg bg-zinc-50 dark:bg-zinc-800/50 ${padding}`}>
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          {emptyHint}
        </Text>
      </div>
    )
  }

  const tone = statusTone(report.status)
  const extraFindings = report.findings.filter(
    (finding) =>
      finding.code !== report.primary.code && finding.code !== "route_ready",
  )
  const hops = report.summary.routeHops.map((pubkey) => truncatePubkey(pubkey))

  return (
    <div
      role="status"
      className={`rounded-lg ${padding} ${tone.shell}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className={`text-xs font-medium ${tone.title}`}>
            {report.primary.title}
          </p>
          <HelpTooltip content={report.primary.recommendation} />
        </div>
        <Badge color={tone.badge}>{statusLabel(report.status)}</Badge>
      </div>

      <p className={`mt-1.5 text-xs text-pretty ${tone.body}`}>
        {report.primary.reason}
      </p>

      {report.status !== "ready" ? (
        <p className={`mt-1 text-xs text-pretty ${tone.body}`}>
          {report.primary.recommendation}
        </p>
      ) : null}

      {hops.length > 0 ? (
        <p className={`mt-2 break-all font-mono text-xs ${tone.mono}`}>
          {hops.join(" → ")}
        </p>
      ) : null}

      {report.status === "ready" || report.status === "risky" ? (
        <dl className={`mt-2 space-y-1 text-xs ${tone.body}`}>
          {report.summary.feeDisplay ? (
            <div className="flex justify-between gap-3">
              <dt>Est. fee</dt>
              <dd className="tabular-nums">{report.summary.feeDisplay}</dd>
            </div>
          ) : null}
          {report.summary.liquidityHeadroomDisplay ? (
            <div className="flex justify-between gap-3">
              <dt>Outbound headroom</dt>
              <dd className="tabular-nums">
                {report.summary.liquidityHeadroomDisplay}
              </dd>
            </div>
          ) : report.summary.firstHopLocalDisplay ? (
            <div className="flex justify-between gap-3">
              <dt>First-hop local</dt>
              <dd className="tabular-nums">
                {report.summary.firstHopLocalDisplay}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {extraFindings.length > 0 ? (
        <ul className={`mt-2 list-disc space-y-1 pl-4 text-xs ${tone.body}`}>
          {extraFindings.map((finding) => (
            <li key={finding.code}>{finding.reason}</li>
          ))}
        </ul>
      ) : null}

      {report.primary.action ? (
        <Button
          href={report.primary.action.href}
          outline
          className="mt-3 text-xs"
        >
          {report.primary.action.label}
        </Button>
      ) : null}
    </div>
  )
}

function statusLabel(status: PreflightStatus): string {
  switch (status) {
    case "ready":
      return "Ready"
    case "risky":
      return "Risky"
    case "blocked":
      return "Blocked"
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

function statusTone(status: PreflightStatus): {
  shell: string
  title: string
  body: string
  mono: string
  badge: "green" | "amber" | "red"
} {
  switch (status) {
    case "ready":
      return {
        shell: "bg-emerald-50 dark:bg-emerald-950/30",
        title: "text-emerald-900 dark:text-emerald-200",
        body: "text-emerald-800 dark:text-emerald-300",
        mono: "text-emerald-800/80 dark:text-emerald-300/80",
        badge: "green",
      }
    case "risky":
      return {
        shell: "bg-amber-50 dark:bg-amber-950/40",
        title: "text-amber-900 dark:text-amber-200",
        body: "text-amber-800 dark:text-amber-300",
        mono: "text-amber-800/80 dark:text-amber-300/80",
        badge: "amber",
      }
    case "blocked":
      return {
        shell:
          "border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30",
        title: "text-red-800 dark:text-red-200",
        body: "text-red-700 dark:text-red-300",
        mono: "text-red-700/80 dark:text-red-300/80",
        badge: "red",
      }
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
