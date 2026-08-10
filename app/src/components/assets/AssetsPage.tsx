import { RefreshCw } from "lucide-react"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { truncateLockScriptArgs } from "../../lib/fnn/format"
import { useAssetsPage } from "../../lib/fnn/useAssetsPage"
import { WalletPortfolioSection } from "../wallet/WalletPortfolioSection"
import { Button } from "../ui/button"
import { Heading } from "../ui/heading"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"

export function AssetsPage() {
  const { running, status } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = useAssetsPage(running)

  const available = data?.available ?? false
  const isPageLoading = running && isLoading && data === null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Assets</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            CKB and UDT balances in your on-chain wallet and Fiber channels.
            Channel and payment pickers only offer tokens in your node
            whitelist.
          </Text>
          {available && data?.lockScript ? (
            <Text className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Funding wallet {truncateLockScriptArgs(data.lockScript.args)}
            </Text>
          ) : null}
        </div>
        <Button
          outline
          onClick={() => void refresh()}
          disabled={!running || isRefreshing}
          aria-label="Refresh assets"
        >
          <RefreshCw
            className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            data-slot="icon"
          />
          Refresh
        </Button>
      </div>

      {error ? (
        <PageErrorBanner
          message={`Failed to load assets: ${error}`}
          onRetry={() => void refresh()}
        />
      ) : null}

      <WalletPortfolioSection
        available={available}
        status={status}
        isLoading={isPageLoading}
        assets={data?.assets ?? []}
        onChainBalances={data?.onChainBalances ?? []}
        channelTotals={data?.channelTotals ?? []}
        onChainError={data?.onChainWalletError}
      />


    </div>
  )
}
