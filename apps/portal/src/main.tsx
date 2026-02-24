import React from "react";
import ReactDOM from "react-dom/client";
import { AppShell, Card } from "@pmm/ui";
import "./styles.css";

type PortalCard = {
  name: string;
  description: string;
  url: string;
};

const cards: PortalCard[] = [
  {
    name: "Admin",
    description: "Manage traits, programs, and brand voice settings.",
    url: "http://localhost:5173"
  },
  {
    name: "Candidate Widget",
    description: "Run the candidate interview flow (voice/chat/quiz).",
    url: "http://localhost:5174/widget"
  },
  {
    name: "Advisor",
    description: "View candidate leads and follow-up workflow.",
    url: "http://localhost:5175"
  }
];

const App = () => {
  return (
    <AppShell>
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <div className="mb-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Program Match Making</p>
          <h1 className="text-4xl font-bold text-slate-900">App Portal</h1>
          <p className="max-w-2xl text-sm text-slate-700">Use this page to jump to each product surface during local development.</p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.name}>
              <div className="flex h-full flex-col gap-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-slate-900">{card.name}</h2>
                  <p className="text-sm text-slate-600">{card.description}</p>
                </div>
                <a
                  href={card.url}
                  className="mt-auto inline-flex w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Open app
                </a>
              </div>
            </Card>
          ))}
        </section>
      </main>
    </AppShell>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
