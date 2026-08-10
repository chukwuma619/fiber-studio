import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

export const alt = 'Fiber Studio — a desktop app for Fiber Network payments'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

const FIBER_MARK_PATH =
  'M7.72 12H23.5L26.5 7H8.5L7.72 12ZM9 36.5L19.5 18.5H12.83L14 13H7.56L6 23H11.87L9 36.5Z'

export default async function Image() {
  const [geistSemiBold, geistRegular] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Geist-SemiBold.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Geist-Regular.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(145deg, #fafafa 0%, #ffffff 42%, #e0f2fe 100%)',
          fontFamily: 'Geist',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: 18,
              background: '#0284c7',
            }}
          >
            <svg
              width="36"
              height="44"
              viewBox="0 0 33 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d={FIBER_MARK_PATH}
                fill="#ffffff"
              />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: '-0.04em',
                color: '#09090b',
              }}
            >
              Fiber
            </span>
            <span
              style={{
                fontSize: 40,
                fontWeight: 400,
                letterSpacing: '-0.04em',
                color: '#0369a1',
              }}
            >
              Studio
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              maxWidth: 920,
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: '-0.05em',
              color: '#09090b',
            }}
          >
            A desktop app for Fiber Network payments.
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 780,
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.4,
              color: '#52525b',
            }}
          >
            Run the official Fiber node, send and receive CKB and UDTs, and keep your
            keys on your device.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 22,
              fontWeight: 400,
              color: '#71717a',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: '#0284c7',
              }}
            />
            Nervos CKB
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 400,
              color: '#0369a1',
            }}
          >
            getfiberstudio.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Geist',
          data: geistSemiBold,
          style: 'normal',
          weight: 600,
        },
        {
          name: 'Geist',
          data: geistRegular,
          style: 'normal',
          weight: 400,
        },
      ],
    }
  )
}
