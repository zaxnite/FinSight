import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";

const ChatPage = lazy(() => import("./pages/ChatPage"));

const LoadingScreen = (
  <div style={{
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-base)",
    color: "var(--accent)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
  }}>
    Loading FinSight...
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/chat"
          element={
            <Suspense fallback={LoadingScreen}>
              <ChatPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}