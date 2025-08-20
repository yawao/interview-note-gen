import Link from 'next/link'

export default function TestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Test Page</h1>
      <p>If you can see this page, Next.js is working correctly!</p>
      <Link href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
        Go to Homepage
      </Link>
    </div>
  )
}