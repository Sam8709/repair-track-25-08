// src/pages/DashboardPage.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useJobs } from '../hooks/useJobs';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

const statusOptions = ['Received', 'Awaiting Parts', 'In Progress', 'Completed'];

const statusChip = (status) => {
  const base = 'inline-block px-2 py-1 text-xs font-semibold rounded';
  switch (status) {
    case 'Received':
      return `${base} bg-gray-200 text-gray-800`;
    case 'Awaiting Parts':
      return `${base} bg-yellow-100 text-yellow-800`;
    case 'In Progress':
      return `${base} bg-blue-100 text-blue-800`;
    case 'Completed':
      return `${base} bg-green-100 text-green-800`;
    default:
      return `${base} bg-gray-200 text-gray-800`;
  }
};

const DashboardPage = () => {
  const navigate = useNavigate();

  // Auth session
  const [session, setSession] = useState(null);
  const userId = session?.user?.id || null;

  // Profile state
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', shop_name: '' });

  // Jobs
  const { jobs, createJob, updateJobStatus, listJobs } = useJobs(session);

  // Filters
  const [filter, setFilter] = useState('OPEN'); // OPEN | COMPLETED | AWAITING
  const filteredJobs = useMemo(() => {
    if (filter === 'COMPLETED') return jobs.filter((j) => j.status === 'Completed');
    if (filter === 'AWAITING') return jobs.filter((j) => j.status === 'Awaiting Parts');
    // OPEN: everything except Completed
    return jobs.filter((j) => j.status !== 'Completed');
  }, [jobs, filter]);

  // Create job form with new fields
  const [form, setForm] = useState({
    customer_name: '',
    customer_whatsapp: '',
    item_name: '',
    problem: '',
    price: '',
    job_description: '' // optional notes; keep if you like
  });

  // Bootstrap session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  // Load profile
  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') {
      toast.error(error.message);
      setProfile(null);
    } else {
      setProfile(data ?? null);
      if (data) {
        setProfileForm({
          full_name: data.full_name ?? '',
          phone: data.phone ?? '',
          shop_name: data.shop_name ?? '',
        });
      }
    }
    setProfileLoading(false);
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const headerTitle = useMemo(() => profile?.shop_name || 'Dashboard', [profile?.shop_name]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Simple India phone validation
  const validINPhone = (phRaw) => {
    const ph = (phRaw || '').replace(/\s+/g, '');
    return /^(\+91)?[6-9]\d{9}$/.test(ph) || /^[6-9]\d{9}$/.test(ph);
  };

  // Generate a human-friendly job code, e.g., RT-2025-000123
  const generateJobCode = async () => {
    const year = new Date().getFullYear();
    // Ask DB for a sequence-ish number by counting current rows for user; adjust as desired
    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    const next = String((count || 0) + 1).padStart(6, '0');
    return `RT-${year}-${next}`;
  };

const [submitting, setSubmitting] = useState(false);

const handleSubmitJob = async (e) => {
  e.preventDefault();
  if (submitting) return;
  setSubmitting(true);

  try {
    if (!profile) {
      toast.error('Please complete your profile first.');
      setProfileOpen(true);
      return;
    }
    if (!form.customer_name || !form.customer_whatsapp || !form.item_name || !form.problem) {
      toast.error('Please fill Customer Name, WhatsApp, Item Name, and Problem.');
      return;
    }
    if (!validINPhone(form.customer_whatsapp)) {
      toast.error('WhatsApp number looks invalid. Use +91XXXXXXXXXX or a 10‑digit Indian number.');
      return;
    }
    const priceNum = Number(form.price || 0);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error('Price must be a valid non-negative number.');
      return;
    }

    const job_code = await generateJobCode();

    const requestId = crypto.randomUUID(); // idempotency key [14]

    await createJob({
      customer_name: form.customer_name,
      customer_whatsapp: form.customer_whatsapp,
      item_name: form.item_name,
      problem: form.problem,
      price: priceNum,
      job_description: form.job_description,
      status: 'Received',
      job_code,
      _request_id: requestId // pass to hook
    });

    setForm({
      customer_name: '',
      customer_whatsapp: '',
      item_name: '',
      problem: '',
      price: '',
      job_description: ''
    });
  } finally {
    setSubmitting(false);
  }
};


  const handlePrintReceipt = async (job) => {
  try {
    const baseUrl = window.location.origin;
    const trackUrl = `${baseUrl}/track/${encodeURIComponent(job.job_code || '')}`;
    const qrDataUrl = await QRCode.toDataURL(trackUrl, { width: 140, margin: 1 });
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) {
      toast.error('Popup blocked. Please allow popups to print.');
      return;
    }
    w.document.write(`
      <html>
        <head>
          <title>Receipt - ${job.job_code || ''}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            @page { size: 80mm auto; margin: 6mm; } /* ticket style */
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif; color: #222; }
            .wrap { max-width: 300px; margin: 0 auto; }
            .h { text-align: left; margin-bottom: 10px; }
            .title { font-size: 20px; font-weight: 700; margin: 0; }
            .sub { font-size: 11px; color: #666; margin-top: 2px; }
            .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
            .label { color: #6b7280; }
            .value { font-weight: 600; text-align: right; }
            .qr { text-align: center; margin-top: 12px; }
            .small { font-size: 11px; color: #6b7280; margin-top: 6px; word-break: break-all; }
            .footer { text-align: center; margin-top: 10px; font-size: 11px; color: #9ca3af; }
            hr { border: none; border-top: 1px dashed #e5e7eb; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="h">
              <div class="title">${profile?.shop_name || 'RepairTrack'}</div>
              <div class="sub">Date: ${now} · Job: ${job.job_code || ''}</div>
            </div>

            <div class="card">
              <div class="row"><div class="label">Customer</div><div class="value">${job.customer_name}</div></div>
              <div class="row"><div class="label">WhatsApp</div><div class="value">${job.customer_whatsapp}</div></div>
            </div>

            <div class="card">
              <div class="row"><div class="label">Item</div><div class="value">${job.item_name || '-'}</div></div>
              <div class="row"><div class="label">Problem</div><div class="value">${job.problem || '-'}</div></div>
              <div class="row"><div class="label">Quoted Price</div><div class="value">₹ ${Number(job.price || 0).toFixed(2)}</div></div>
              <hr />
              <div class="row"><div class="label">Status</div><div class="value">${job.status}</div></div>
            </div>

            <div class="qr">
              <img src="${qrDataUrl}" alt="Track QR" />
              <div class="small">Scan to track: ${trackUrl}</div>
            </div>

            <div class="footer">Thank you!</div>
          </div>
          <script>setTimeout(()=>{ window.print(); window.close(); }, 300);</script>
        </body>
      </html>
    `);
    w.document.close();
  } catch (e) {
    toast.error('Could not generate receipt.');
  }
  };


  const saveProfile = async (e) => {
    e.preventDefault();
    if (!userId) return;

    const fn = profileForm.full_name.trim();
    const ph = profileForm.phone.trim();
    const sn = profileForm.shop_name.trim();
    if (!fn || !ph || !sn) {
      toast.error('Please fill Full name, Phone, and Shop name.');
      return;
    }
    if (!validINPhone(ph)) {
      toast.error('Phone looks invalid.');
      return;
    }

    const payload = { id: userId, full_name: fn, phone: ph, shop_name: sn };
    const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Profile saved');
    setProfile(data);
    setProfileOpen(false);
  };

  const refresh = async (key) => {
    // Optional hook refresh if you add one; here, reload list and keep filter
    await listJobs?.();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{headerTitle}</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setProfileOpen(true)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded"
            >
              Profile
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Incomplete profile hint */}
        {!profileLoading && !profile && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-3 mb-6">
            Complete your profile to personalize your dashboard and enable job creation.
            <button
              onClick={() => setProfileOpen(true)}
              className="ml-3 underline text-yellow-900 hover:text-yellow-800"
            >
              Open Profile
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-3 rounded shadow mb-6 flex items-center gap-2">
          <span className="text-sm text-gray-600 mr-2">Quick filters:</span>
          <button
            onClick={() => setFilter('OPEN')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'OPEN' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            My Open Jobs
          </button>
          <button
            onClick={() => setFilter('AWAITING')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'AWAITING' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            Awaiting Parts
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'COMPLETED' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            Completed
          </button>

          <div className="ml-auto">
            <button
              onClick={() => refresh()}
              className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Create Job */}
        <section className="bg-white p-4 rounded shadow mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Create Job</h2>
            {!profile && <span className="text-sm text-gray-500">Profile required</span>}
          </div>
          <form onSubmit={handleSubmitJob} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="border rounded px-3 py-2"
              placeholder="Customer name"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="WhatsApp (+91...)"
              value={form.customer_whatsapp}
              onChange={(e) => setForm({ ...form, customer_whatsapp: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Item name (e.g., iPhone 12)"
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2 md:col-span-2"
              placeholder="Problem (e.g., screen cracked)"
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Price (₹)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2 md:col-span-3"
              placeholder="Notes (optional)"
              value={form.job_description}
              onChange={(e) => setForm({ ...form, job_description: e.target.value })}
            />

            <button
              type="submit"
              disabled={!profile || submitting}
              className={`text-white rounded px-4 py-2 ${
              !profile || submitting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
              }`}
              >
          {submitting ? 'Adding…' : 'Add Job'}
          </button>
          </form>
        </section>

        {/* Jobs Table */}
        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Jobs</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Job</th>
                  <th className="text-left p-2">Customer</th>
                  <th className="text-left p-2">WhatsApp</th>
                  <th className="text-left p-2">Item</th>
                  <th className="text-left p-2">Problem</th>
                  <th className="text-left p-2">Price</th>
                  <th className="text-left p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-b">
                    <td className="p-2">{job.job_code || '-'}</td>
                    <td className="p-2">{job.customer_name}</td>
                    <td className="p-2">{job.customer_whatsapp}</td>
                    <td className="p-2">{job.item_name || '-'}</td>
                    <td className="p-2">{job.problem || '-'}</td>
                    <td className="p-2">₹ {Number(job.price || 0).toFixed(2)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className={statusChip(job.status)}>{job.status}</span>
                        <select
                          value={job.status}
                          onChange={(e) => updateJobStatus(job.id, e.target.value)}
                          className="border rounded px-2 py-1"
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateJobStatus(job.id, 'Completed')}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                        >
                          Done
                        </button>
                        <button
                          onClick={() => handlePrintReceipt(job)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-1 rounded"
                        >
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={8}>
                      No jobs found for this filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Profile slide-over */}
      {profileOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProfileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Profile</h3>
              <button
                onClick={() => setProfileOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full name</label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  placeholder="e.g., Rahul Verma"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+91XXXXXXXXXX"
                />
                <p className="text-xs text-gray-500 mt-1">Use +91XXXXXXXXXX or a 10‑digit Indian mobile number.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shop name</label>
                <input
                  className="border rounded w-full px-3 py-2"
                  value={profileForm.shop_name}
                  onChange={(e) => setProfileForm({ ...profileForm, shop_name: e.target.value })}
                  placeholder="e.g., SkyTech Mobile Repairs"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
