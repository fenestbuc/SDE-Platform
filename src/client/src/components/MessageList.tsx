import React from 'react';

export function MessageList({ messages, tab, onOpenMessage }: { messages: any[], tab: 'inbox'|'sent', onOpenMessage: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {messages.length === 0 ? <p className="text-gray-500 italic">No messages found.</p> : 
        messages.map(m => {
          const otherPartyField = tab === 'inbox' ? 'sender' : 'recipient';
          const otherName = m[otherPartyField].displayName || m[otherPartyField].username;
          return (
            <div key={m.id} onClick={() => onOpenMessage(m.id)} className="bg-white p-4 rounded shadow border border-transparent cursor-pointer hover:border-blue-400 hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <div className="font-bold text-gray-800">
                  {tab === 'inbox' ? 'From' : 'To'}: {otherName}
                  {!m.readAt && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-3 shadow-sm">NEW</span>}
                  {m.hasAttachment && <span className="ml-2" title="Has attachment">📎</span>}
                </div>
                <div className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
              </div>
            </div>
          )
        })
      }
    </div>
  );
}