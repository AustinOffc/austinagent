import { redirect } from 'next/navigation';

// Pintu masuk: gerbang login ada di (app)/layout.tsx (klien), karena token tidak terlihat di server.
export default function Home() {
  redirect('/dashboard');
}
