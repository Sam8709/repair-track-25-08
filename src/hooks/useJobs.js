// src/hooks/useJobs.js
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export function useJobs(session) {
  const [jobs, setJobs] = useState([]);
  const userId = session?.user?.id || null;

  const listJobs = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setJobs(data || []);
  }, [userId]);

  const createJob = useCallback(async (payload) => {
  if (!userId) return;

  const { data, error } = await supabase
    .rpc('create_job_with_code', {
      p_user_id: userId,
      p_customer_name: payload.customer_name,
      p_customer_whatsapp: payload.customer_whatsapp,
      p_item_name: payload.item_name,
      p_problem: payload.problem,
      p_price: payload.price ?? 0,
      p_job_description: payload.job_description ?? ''
    });

  if (error) {
    toast.error(error.message);
  } else {
    setJobs((prev) => [data, ...prev]);
    toast.success(`Job created (${data.job_code})`);
  }
  }, [userId]);

  const updateJobStatus = useCallback(async (id, status) => {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      setJobs((prev) => prev.map(j => (j.id === id ? { ...j, ...data } : j)));
      toast.success('Status updated');
    }
  }, []);

  useEffect(() => { listJobs(); }, [listJobs]);

  return { jobs, listJobs, createJob, updateJobStatus };
}
