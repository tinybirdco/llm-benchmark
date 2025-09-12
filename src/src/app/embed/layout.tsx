import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "../globals.css";

export const metadata: Metadata = {
  title: "AI SQL Benchmark - Embed",
  description: "Embeddable table view of AI SQL benchmark results",
};

const roboto = Roboto({
  weight: ["400"],
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  weight: ["400"],
  subsets: ["latin"],
});

export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono&display=swap"
          rel="stylesheet"
        />
        <style jsx global>{`
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
        `}</style>
      </head>
      <body className={`${roboto.className} ${robotoMono.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
