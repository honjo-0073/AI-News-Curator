import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI News Curator',
  description: 'AI-Powered Automated Curating & Newsletter Service',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="flex flex-col min-h-screen">
          {/* ナビゲーションバー */}
          <header style={{
            borderBottom: '1px solid var(--border-card)',
            backdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'rgba(9, 13, 22, 0.7)'
          }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Link href="/" style={{
                fontSize: '1.5em',
                fontWeight: 'bold',
                textDecoration: 'none',
                color: 'white',
                fontFamily: 'var(--font-title)'
              }}>
                <span className="gradient-text">AI Curator</span>
              </Link>
              
              <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <Link href="/articles" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.95em' }}>
                  収集記事
                </Link>
                <Link href="/sources" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.95em' }}>
                  収集元設定
                </Link>
                <Link href="/recipients" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.95em' }}>
                  配信先
                </Link>
                <Link href="/logs" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.95em' }}>
                  実行ログ
                </Link>
                <Link href="/settings" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.95em' }}>
                  設定
                </Link>
              </nav>
            </div>
          </header>
          
          {/* メインコンテンツ */}
          <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
            {children}
          </main>
          
          {/* フッター */}
          <footer style={{
            borderTop: '1px solid var(--border-card)',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85em',
            background: 'rgba(9, 13, 22, 0.5)'
          }}>
            &copy; {new Date().getFullYear()} AI Curator. All rights reserved.
          </footer>
        </div>
      </body>
    </html>
  );
}
