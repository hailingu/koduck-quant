import "./App.css";
import { FlowDemo } from "./components/demo/FlowDemo";
import { E2ERuntimeHarness } from "./components/testing/E2ERuntimeHarness";

function App() {
  return (
    <main className="app-shell">
      <header className="app-hero">
        <h1>Koduck Flow Playground</h1>
        <p>
          Explore the interactive flow renderer and, alongside it, a deterministic harness that
          powers our automated end-to-end scenarios.
        </p>
      </header>

      <section className="app-grid">
        <div className="app-primary">
          <div className="section-heading">
            <h2>Interactive Flow Demo</h2>
            <p>Experiment with nodes, connections, and runtime interactions in real time.</p>
          </div>
          <FlowDemo />
        </div>

        <aside className="app-harness" aria-label="E2E Runtime Harness">
          <div className="section-heading">
            <h2>E2E Runtime Harness</h2>
            <p>
              Provides predictable selectors and workflows for Playwright suites while remaining
              usable by humans.
            </p>
          </div>
          <E2ERuntimeHarness />
        </aside>
      </section>
    </main>
  );
}

export default App;
