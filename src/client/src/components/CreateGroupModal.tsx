import React, { useState } from 'react';
import { apiFetch } from '../lib/api';

export default function CreateGroupModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const [name, setName] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // For this demo, users enter comma-separated exact usernames.
      const usernames = membersInput.split(',').map(s => s.trim()).filter(Boolean);
      
      const memberIds = [];
      for (const un of usernames) {
        const u = await apiFetch(`/users/${un}`);
        memberIds.push(u.id);
      }
      
      await apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, members: memberIds })
      });
      
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="p-6 bg-white rounded shadow-lg w-96">
        <h3 className="mb-4 text-xl font-bold">Create Group</h3>
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">Group Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium">Members (usernames, comma-separated)</label>
            <input type="text" value={membersInput} onChange={e => setMembersInput(e.target.value)} placeholder="alice, bob" className="w-full p-2 border rounded" required />
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-blue-600 rounded">{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}