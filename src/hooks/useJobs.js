// src/hooks/useJobs.js
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export function useJobs(session) {
  const [jobs, setJobs] = useState([]);
  const userId = session?.user?.id || null;

  // 1) Load jobs
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

  // 2) WhatsApp helpers
  function normalizeWhatsApp(number) {
    const s = (number || '').replace(/\s+/g, '');
    if (s.startsWith('+')) return s;                 // already E.164
    if (/^[6-9]\d{9}$/.test(s)) return `+91${s}`;    // 10-digit India -> +91
    return s;                                        // fallback
  }

  async function sendWhatsApp({ to, body, contentSid, contentVariables }) {
    try {
      await fetch('/.netlify/functions/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body, contentSid, contentVariables }),
      });
    } catch (e) {
      // Non-blocking: job creation/update should not fail if messaging fails
      console.error('WhatsApp send failed:', e);
    }
  }

  // 3) Create job (DB + notify)
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
      return;
    }

    setJobs((prev) => [data, ...prev]);
    toast.success(`Job created (${data.job_code})`);

    // Fire-and-forget WhatsApp message (Sandbox / 24h session -> free-form body)
    const to = normalizeWhatsApp(data.customer_whatsapp);
    await sendWhatsApp({
      to,
      body: `Hi ${data.customer_name}, we’ve received your ${data.item_name}. Job: ${data.job_code}.`,
      // If sending a template later (outside 24h), pass:
      // contentSid: 'HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // approved template SID
      // contentVariables: { "1": data.customer_name, "2": data.item_name, "3": data.job_code }
    });
  }, [userId]);

  // 4) Update status (DB + notify)
  const updateJobStatus = useCallback(async (id, status) => {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setJobs((prev) => prev.map(j => (j.id === id ? { ...j, ...data } : j)));
    toast.success('Status updated');

    const to = normalizeWhatsApp(data.customer_whatsapp);
    await sendWhatsApp({
      to,
      body: `Update for Job ${data.job_code}: Status changed to "${data.status}".`,
      // For template usage later:
      // contentSid: 'HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      // contentVariables: { "1": data.job_code, "2": data.status, "3": `${window.location.origin}/track/${data.job_code}` }
    });
  }, []);

  useEffect(() => { listJobs(); }, [listJobs]);

  return { jobs, listJobs, createJob, updateJobStatus };
}
