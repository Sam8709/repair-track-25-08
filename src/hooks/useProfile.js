import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export function useProfile(session) {
  const uid = session?.user?.id || null;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (error && error.code !== 'PGRST116') {
      toast.error(error.message);
    } else {
      setProfile(data ?? null);
    }
    setLoading(false);
  }, [uid]);

  const upsertProfile = useCallback(async ({ full_name, phone, shop_name }) => {
    if (!uid) return;
    const payload = { id: uid, full_name, phone, shop_name };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      toast.success('Profile saved');
      setProfile(data);
    }
  }, [uid]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return { profile, loading, fetchProfile, upsertProfile };
}
