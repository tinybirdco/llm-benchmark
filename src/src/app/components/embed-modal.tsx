"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Button } from "./button";
import { Copy, ExternalLink } from "lucide-react";

type EmbedModalProps = {
  children: React.ReactNode;
};

export const EmbedModal = ({ children }: EmbedModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeCode, setIframeCode] = useState('');

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
    const code = `<iframe 
    src="${origin}/embed" 
    width="100%" 
    height="600" 
    frameborder="0"
    title="LLM SQL Benchmark Table"
    allow="clipboard-write">
</iframe>`;
    setIframeCode(code);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handlePreview = () => {
    window.open('/embed', '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-[#0A0A0A] border-[#353535] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Embed on Your Website</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <p className="text-sm text-[#C6C6C6] mb-4">
              Copy the code below to embed the benchmark table on your website. The table will be fully interactive and scrollable.
            </p>
            
            <div className="bg-[#1A1A1A] border border-[#353535] rounded p-4 relative">
              <pre className="text-sm text-[#F4F4F4] overflow-x-auto whitespace-pre-wrap">
                <code>{iframeCode}</code>
              </pre>
              
              <Button
                onClick={handleCopy}
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
              >
                {copied ? "Copied!" : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Customization Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#1A1A1A] border border-[#353535] rounded p-3">
                <h4 className="font-medium text-white mb-2">Width & Height</h4>
                <p className="text-[#C6C6C6]">
                  Adjust <code className="bg-[#353535] px-1 rounded">width</code> and <code className="bg-[#353535] px-1 rounded">height</code> attributes to fit your layout.
                </p>
              </div>
              
              <div className="bg-[#1A1A1A] border border-[#353535] rounded p-3">
                <h4 className="font-medium text-white mb-2">Responsive Design</h4>
                <p className="text-[#C6C6C6]">
                  Use <code className="bg-[#353535] px-1 rounded">width="100%"</code> for responsive iframes.
                </p>
              </div>
              
              <div className="bg-[#1A1A1A] border border-[#353535] rounded p-3">
                <h4 className="font-medium text-white mb-2">Features Included</h4>
                <ul className="text-[#C6C6C6] space-y-1">
                  <li>• Sortable columns</li>
                  <li>• Tooltips with descriptions</li>
                  <li>• Color-coded performance indicators</li>
                  <li>• Scrollable content</li>
                </ul>
              </div>
              
              <div className="bg-[#1A1A1A] border border-[#353535] rounded p-3">
                <h4 className="font-medium text-white mb-2">Browser Support</h4>
                <p className="text-[#C6C6C6]">
                  Works in all modern browsers. No additional dependencies required.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[#353535]">
            <Button
              onClick={handlePreview}
              variant="default"
              className="bg-[#27F795] hover:bg-[#267A52] text-black"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Preview Embed
            </Button>
            
            <Button
              onClick={() => setIsOpen(false)}
              variant="secondary"
              className="hover:bg-accent hover:text-background"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
