import { useEffect } from 'react';
import { StoreProvider, useStore } from './store';
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

function Screens() {
  const { route, navigate } = useRouter();
  const { state, actions } = useStore();
  const needsMember = route.name !== 'landing';

  // Signed-out visitors land on the join page; signing in from there opens the app.
  useEffect(() => {
    if (state.status === 'signedOut' && needsMember) navigate('/');
  }, [state.status, needsMember, navigate]);

  let content;
  if (state.status === 'loading' && needsMember) {
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
