// FILE LOCATION: next.config.ts  (project root)
//
// Serves the static landing page at "/" without converting its
// 31 KB of DOM-driven JavaScript into React. The file lives in
// public/landing.html and is returned untouched, so every
// animation and scroll effect behaves exactly as it does today.
//
// beforeFiles runs the rewrite ahead of route resolution, so it
// wins even if an app/page.tsx exists. Deleting app/page.tsx is
// still recommended, to avoid two things claiming the same URL.

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          destination: '/landing.html',
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig