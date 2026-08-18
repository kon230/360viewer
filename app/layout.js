import './globals.css';
import { ViewerProvider } from '@/lib/store';

export const metadata = {
  title: '360° インテリアパースビューア',
  description: 'インテリアパースの360度パノラマプレビューア',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <ViewerProvider>{children}</ViewerProvider>
      </body>
    </html>
  );
}
