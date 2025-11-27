import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { COPY } from '../constants/microcopy';

interface ArchivistLogProps {
  notes: string | null;
  isLoading: boolean;
  videoId: string | null;
}

export function ArchivistLog({ notes, isLoading, videoId }: ArchivistLogProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!notes) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setDisplayedText('');
    let index = 0;

    const interval = setInterval(() => {
      if (index < notes.length) {
        setDisplayedText(notes.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [notes]);

  if (!videoId) {
    return null;
  }

  return (
    <div className="border border-zinc-800 p-4 bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-3 h-3 text-zinc-600" />
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
          {COPY.ARCHIVIST_NOTES}
        </span>
      </div>

      {/* Content */}
      <div className="text-sm text-zinc-400 leading-relaxed">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 animate-pulse">
              ANALYZING SIGNAL...
            </span>
            <span className="inline-block w-2 h-4 bg-amber-500 animate-pulse" />
          </div>
        ) : notes ? (
          <div className="relative">
            <span>{displayedText}</span>
            {isTyping && (
              <span className="inline-block w-[2px] h-4 bg-amber-500 ml-[2px] animate-blink" />
            )}
          </div>
        ) : (
          <span className="text-zinc-700 italic">// awaiting analysis</span>
        )}
      </div>

      {/* Add blink animation via inline style tag */}
      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </div>
  );
}
