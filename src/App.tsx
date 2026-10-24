import { useEffect } from 'react';
import { StoreProvider, isPaying, useStore } from './store';
import { tierById } from './content';
import { RouterProvider, useRouter } from './router';
import { AppShell, Splash, Toast } from './components/AppShell';
import { AuthSheet } from './components/AuthSheet';
import { Landing } from './pages/Landing';
import { Home } from './pages/Home';
import { Deck } from './pages/Deck';
import { Lesson } from './pages/Lesson';
import { Table } from './pages/Table';
import { Ace } from './pages/Ace';
import { You } from './pages/You';
import { Legal } from './pages/Legal';

function Screens() {
  const { route, navigate } = useRouter();
  const { state, actions } = useStore();
  // The join page and the policies are public; everything else needs a signed-in member.
  const needsMember = route.name !== 'landing' && route.name !== 'legal';

  // Signed-out visitors land on the join page; signing in from there opens the app.
  useEffect(() => {
    if (state.status === 'signedOut' && needsMember) navigate('/');
  }, [state.status, needsMember, navigate]);

  // Back from Stripe Checkout: the plan changes when Stripe tells the server, usually within seconds.
  const signedIn = state.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    let search = '';
    try { search = window.location.search; } catch { /* ignore */ }
    // ?checkout=success after joining; ?changed=<plan> after switching plan in the billing portal.
    const params = new URLSearchParams(search);
    const joined = params.get('checkout') === 'success';
    const changedTo = params.get('changed');
    const target = changedTo === 'deck' || changedTo === 'ace' || changedTo === 'royal' ? changedTo : null;
    if (!joined && !target) return;
    try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch { /* ignore */ }
    actions.notify('ok', joined ? 'Payment received. Setting up your plan…' : 'Updating your plan…');
    let tries = 0;
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      const m = await actions.refreshProfile();
      if (m && isPaying(m) && (!target || m.tier === target)) {
        actions.notify('ok', joined ? `Welcome to the ${tierById(m.tier).name}.` : `Plan updated: ${tierById(m.tier).name}.`);
        return;
      }
      if (++tries < 15) window.setTimeout(check, 2000);
      else actions.notify('error', 'Your payment went through but your plan is taking a while. Refresh in a minute, or message Jack.');
    };
    void check();
    return () => { stopped = true; };
  }, [signedIn, actions]);

  let content;
  if (route.name === 'legal') {
    content = <Legal key={route.doc} slug={route.doc} />;
  } else if (state.status === 'loading' && needsMember) {
    content = <Splash />;
  } else if (!needsMember || !state.member) {
    content = <Landing />;
  } else {
    let screen;
    switch (route.name) {
      case 'home': screen = <Home />; break;
      case 'deck': screen = <Deck />; break;
      case 'lesson': screen = <Lesson key={route.id} id={route.id} />; break;
      case 'table': screen = <Table />; break;
      case 'ace': screen = <Ace />; break;
      case 'you': screen = <You />; break;
    }
    content = <AppShell>{screen}</AppShell>;
  }

  return (
    <>
      {content}
      {state.recovering && <AuthSheet mode="newPassword" onClose={actions.finishRecovery} />}
      <Toast />
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <RouterProvider>
        <Screens />
      </RouterProvider>
    </StoreProvider>
  );
}
