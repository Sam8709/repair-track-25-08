import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import { useProfile } from './hooks/useProfile';

function Shell() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setAuthLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === 'SIGNED_IN') navigate('/dashboard');
      if (event === 'SIGNED_OUT') navigate('/');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { profile, loading: profileLoading } = useProfile(session);

  if (authLoading || (session && profileLoading)) return <div className="p-4">Loading...</div>;

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={!session ? <LoginPage /> : <Navigate to="/dashboard" />} />
        <Route path="/profile-setup" element={session ? <ProfileSetupPage /> : <Navigate to="/" />} />
        <Route
          path="/dashboard"
          element={
            !session ? <Navigate to="/" /> :
            !profile ? <Navigate to="/profile-setup" /> :
            <DashboardPage />
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
