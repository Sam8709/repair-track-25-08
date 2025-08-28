import React, { useState, useEffect } from 'react';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

const ProfileSetupPage = () => {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const { upsertProfile } = useProfile(session);
  const [form, setForm] = useState({ full_name: '', phone: '', shop_name: '' });

  const submit = async (e) => {
    e.preventDefault();
    await upsertProfile(form);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-6 rounded shadow w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Set up profile</h1>
        <form onSubmit={submit} className="space-y-4">
          <input className="border rounded w-full px-3 py-2" placeholder="Full name"
            value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <input className="border rounded w-full px-3 py-2" placeholder="Phone (+91...)"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="border rounded w-full px-3 py-2" placeholder="Shop name"
            value={form.shop_name} onChange={e => setForm({ ...form, shop_name: e.target.value })} />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
