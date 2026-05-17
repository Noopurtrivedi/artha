import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, FileText, Presentation, Table2, FileImage } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../../stores/chat';

export default function ChatWindow() {
  const { messages, streamingContent, isStreaming, activeSessionId, addUserMessage } = useChatStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent]);

  const send = async () => {
    const text = input.trim();
    if (!text || !activeSessionId) return;
    setInput('');
    addUserMessage(activeSessionId, text);
    await window.artha.agent.sendMessage(activeSessionId, text);
  };

  const quickDoc = (type: string) => {
    setInput(`Generate a ${type} document: `);
  };

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-artha-muted">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Artha</h1>
          <p className="text-sm">Your work, done. Locally.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-80">
          {[
            { icon: FileText,     label: 'Word Document',  type: 'DOCX' },
            { icon: Presentation, label: 'Presentation',   type: 'PPTX' },
            { icon: Table2,       label: 'Spreadsheet',    type: 'XLSX' },
            { icon: FileImage,    label: 'PDF Report',     type: 'PDF'  },
          ].map(({ icon: Icon, label, type }) => (
            <button key={type} onClick={() => quickDoc(type)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-artha-s2 border border-artha-border hover:border-artha-accent/50 transition-colors text-sm">
              <Icon size={16} className="text-artha-accent" /> {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${msg.senderType === 'user'
                ? 'bg-artha-accent text-white'
                : 'bg-artha-s2 border border-artha-border text-artha-text'}`}>
              {msg.senderType === 'agent'
                ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                : msg.content}
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm bg-artha-s2 border border-artha-border">
              <ReactMarkdown>{streamingContent}</ReactMarkdown>
              <span className="inline-block w-2 h-4 bg-artha-accent ml-1 animate-pulse rounded-sm" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6">
        <div className="flex items-end gap-2 bg-artha-s2 border border-artha-border rounded-2xl p-3 focus-within:border-artha-accent/50 transition-colors">
          <button className="text-artha-muted hover:text-white transition-colors p-1">
            <Paperclip size={18} />
          </button>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Describe a task or document to generate…"
            rows={1} className="flex-1 bg-transparent text-sm resize-none outline-none text-artha-text placeholder-artha-muted max-h-32"
            style={{ minHeight: '1.5rem' }} />
          <button onClick={send} disabled={!input.trim() || isStreaming}
            className="p-2 rounded-xl bg-artha-accent hover:bg-artha-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-artha-muted text-center mt-2">All processing happens locally · No data leaves your machine</p>
      </div>
    </div>
  );
}
