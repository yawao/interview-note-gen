/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is enabled by default in Next.js 15
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  }
}

export default nextConfig