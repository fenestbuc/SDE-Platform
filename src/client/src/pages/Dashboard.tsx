import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { ComposeForm } from '../components/ComposeForm';
import { MessageList } from '../components/MessageList';
import CreateGroupModal from '../components/CreateGroupModal';
import { MessageModal } from '../components/MessageModal';

export default function Dashboard() {
  const { username, logout, worker } = useAppStore();
  const [tab, setTab] = useState<'inbox'|'sent'|'groups'>('inbox');
  const [messages, setMessages] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  const [activeMessage, setActiveMessage] = useState<any>(null);
  const [decryptedBody, setDecryptedBody] = useState<string>('');

  useEffect(() => {
    loadMessages();

    const handleNewMessage = () => {
      // Reload messages if the active tab is inbox
      if (tab === 'inbox') {
        loadMessages();
      }
    };
    window.addEventListener('ws:new_message', handleNewMessage);
    return () => window.removeEventListener('ws:new_message', handleNewMessage);
  }, [tab]);

  const loadMessages = async () => {
    try {
      if (tab === 'groups') {
        const grps = await apiFetch(`/groups`);
        setGroups(grps);
      } else {
        const msgs = await apiFetch(`/messages/${tab}`);
        setMessages(msgs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openMessage = async (id: string) => {
    if (!worker) return;
    try {
      setDecryptedBody('Decrypting...');
      const m = await apiFetch(`/messages/${id}`);
      setActiveMessage(m);
      
      const msgId = "dec-" + Date.now();
      
      if (m.groupId) {
        // Mock group decryption:
        // Assume we locally know the symKey for this group.
        const symKey = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
        const doDecryptGroupText = () => new Promise<string>((resolve, reject) => {
          const handler = (ev: MessageEvent) => {
            if (ev.data.id === msgId) {
              worker.removeEventListener('message', handler);
              ev.data.success ? resolve(ev.data.result) : reject(ev.data.error);
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ type: 'DECRYPT_GROUP_PAYLOAD', id: msgId, payload: {
            ciphertextB64: m.ciphertext,
            ivB64: m.iv,
            tagB64: m.tag,
            senderKeyHex: symKey,
            isString: true
          }});
        });
        const text = await doDecryptGroupText();
        setDecryptedBody(text);
        
        // Groups: read state is not tracked individually for now
      } else {
        const doDecryptText = () => new Promise<string>((resolve, reject) => {
          const handler = (ev: MessageEvent) => {
            if (ev.data.id === msgId) {
              worker.removeEventListener('message', handler);
              ev.data.success ? resolve(ev.data.result) : reject(ev.data.error);
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ type: 'DECRYPT_PAYLOAD', id: msgId, payload: {
            ciphertextB64: m.ciphertext,
            ivB64: m.iv,
            tagB64: m.tag,
            ePubHex: m.ephemeralPubKey,
            isString: true,
            preKeyId: m.preKeyId // NEW in v6
          }});
        });
        
        const text = await doDecryptText();
        setDecryptedBody(text);
        
        if (m.recipientId === sessionStorage.getItem('userId')) {
          await apiFetch(`/messages/${id}/read`, { method: 'POST' });
        }
      }
    } catch (e: any) {
      setDecryptedBody('Error: ' + e.message);
    }
  };

  const downloadFileGroup = async () => {
    alert("Group file downloading currently disabled.");
  };

  // Prevent TS errors if not used
  void downloadFileGroup;

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <nav className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="text-xl font-extrabold tracking-tight">SDE Dashboard</div>
        <div className="flex items-center space-x-6">
          <span className="font-medium text-blue-100">Welcome, {username}</span>
          <button onClick={logout} className="text-sm bg-blue-800 hover:bg-blue-900 px-4 py-2 rounded-full transition shadow-inner">Logout</button>
        </div>
      </nav>
      
      <div className="container mx-auto mt-8 flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-8 px-4 max-w-6xl">
        <ComposeForm onMessageSent={() => { if (tab === 'sent') loadMessages(); }} />
        
        <div className="w-2/3 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex border-b border-gray-200 mb-6">
            <button onClick={() => setTab('inbox')} className={`px-6 py-3 font-semibold text-sm transition-colors ${tab === 'inbox' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Inbox</button>
            <button onClick={() => setTab('sent')} className={`px-6 py-3 font-semibold text-sm transition-colors ${tab === 'sent' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Sent</button>
            <button onClick={() => setTab('groups')} className={`px-6 py-3 font-semibold text-sm transition-colors ${tab === 'groups' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Groups</button>
          </div>
          
          {tab === 'groups' ? (
            <div>
              <div className="mb-4 text-right">
                <button onClick={() => setShowCreateGroup(true)} className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700">Create New Group</button>
              </div>
              {groups.length === 0 ? <p className="text-gray-500 italic">No groups found.</p> : (
                <div className="space-y-4">
                  {groups.map(g => (
                    <div key={g.id} className="p-4 bg-white border border-gray-200 rounded shadow-sm">
                      <div className="font-bold text-lg">{g.name}</div>
                      <div className="text-sm text-gray-500">Members: {g.members.map((m: any) => m.user.displayName || m.user.username).join(', ')}</div>
                      <div className="mt-2 text-xs text-blue-600">Send to: group:{g.id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <MessageList messages={messages} tab={tab} onOpenMessage={openMessage} />
          )}
        </div>
      </div>

      {activeMessage && (
        <MessageModal 
          activeMessage={activeMessage} 
          decryptedBody={decryptedBody} 
          onClose={() => { setActiveMessage(null); loadMessages(); }} 
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal 
          onClose={() => setShowCreateGroup(false)} 
          onCreated={() => { setShowCreateGroup(false); setTab('groups'); loadMessages(); }} 
        />
      )}
    </div>
  );
}
