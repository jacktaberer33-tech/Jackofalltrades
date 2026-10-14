import { useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import { RouterProvider, useRouter } from './router';
import { AppShell } from './components/AppShell';
import { Landing } from './pages/Landing';
import { Home } from './pages/Home';
import { Deck } from './pages/Deck';
import { Lesson } from './pages/Lesson';
import { Table } from './pages/Table';
import { Ace } from './pages/Ace';
import { You } from './pages/You';

function Screens() {
  const { route, navigate } = useRouter();
  const { state } = useStore();
  const needsMember = route.name !== 'landing';

  useEffect(() => {
    if (needsMember && !state.member) navigate('/');
  }, [needsMember, state.member, navigate]);

  if (!needsMember || !state.member) return <Landing />;

  let screen;
  switch (route.name) {
    case 'home': screen = <Home />; break;
    case 'deck': screen = <Deck />; break;
    case 'lesson': screen = <Lesson key={route.id} id={route.id} />; break;
    case 'table': screen = <Table />; break;
    case 'ace': screen = <Ace />; break;
    case 'you': screen = <You />; break;
  }
  return <AppShell>{screen}</AppShell>;
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
