export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="font-serif text-2xl">Sayfa bulunamadı</h1>
      <p className="mt-2 text-muted">
        Atlas tek sayfalık bir uygulamadır. <a className="text-accent underline" href="/">Ana sayfaya dönün</a>.
      </p>
    </main>
  );
}
