import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI SQL Benchmark",
  description: "We benchmark the performance of AI SQL models against a human baseline to help you choose the best model for your needs.",
};

const roboto = Roboto({
  weight: ["400"],
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  weight: ["400"],
  subsets: ["latin"],
});

export default function RootLayout({
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
      </head>
      <body className={`${roboto.className} ${robotoMono.className} antialiased`}>{children}</body>
    </html>
  );
}
