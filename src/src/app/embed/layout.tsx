import "../globals.css";

export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="embed-body" style={{ fontFamily: 'Roboto, sans-serif' }}>
      {children}
    </div>
  );
}
