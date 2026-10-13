import { useNavigate } from 'react-router-dom';

// Back to the previous in-app page; when the page was opened directly, go to the fallback instead of leaving the app.
export default function useGoBack() {
  const navigate = useNavigate();
  return (fallback) => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
