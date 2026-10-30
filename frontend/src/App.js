import "@/App.css";
import { useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Show, SignIn, SignUp, useAuth } from "@clerk/react";
import { Toaster } from "@/components/ui/sonner";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import SiteDetail from "@/pages/SiteDetail";
import Report from "@/pages/Report";
import Demo from "@/pages/Demo";
import AuthShell from "@/components/AuthShell";

const Protected = ({ children }) => {
  const { isSignedIn } = useAuth();
  const wasIn = useRef(false);
  if (isSignedIn) wasIn.current = true;
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><Navigate to={wasIn.current ? "/" : "/sign-in"} replace /></Show>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ClerkAuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/sign-in/*" element={<AuthShell><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthShell>} />
          <Route path="/sign-up/*" element={<AuthShell><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthShell>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/sites/:id" element={<Protected><SiteDetail /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster theme="dark" position="top-right" richColors />
      </ClerkAuthProvider>
    </BrowserRouter>
  );
}

export default App;
