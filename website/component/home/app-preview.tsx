import { Button } from '@/component/ui/button'
import {
  AppPreviewShell,
  PreviewPageCard,
  PreviewPageTitle,
  PreviewStatCard,
} from '@/component/home/preview-shell'

/** Static visual clone of the desktop app Home screen. */
export function AppPreview() {
  return (
    <AppPreviewShell current="Home">
      <PreviewPageCard>
        <div className="space-y-8">
          <PreviewPageTitle
            title="Home"
            subtitle="Your Fiber balance, on-chain CKB, and recent payments."
            actions={
              <>
                <Button>Receive</Button>
                <Button outline>Send</Button>
                <Button outline>Add funds</Button>
              </>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <PreviewStatCard
              label="Spendable"
              value="1,240 CKB"
              subtext="CKB you can send over Fiber"
            />
            <PreviewStatCard
              label="On-chain"
              value="1,240.5 CKB"
              subtext="CKB in this wallet, outside Fiber"
            />
          </div>
        </div>
      </PreviewPageCard>
    </AppPreviewShell>
  )
}
