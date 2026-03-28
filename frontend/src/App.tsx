import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner@2.0.3';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;