import "./App.css";
import { FlowDemo } from "./components/demo/FlowDemo";
import { E2ERuntimeHarness } from "./components/testing/E2ERuntimeHarness";

function shouldShowE2EHarness() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.has("e2e") || window.navigator.webdriver === true;
}

function App() {
  const showE2EHarness = shouldShowE2EHarness();

  return (
    <main className="app-shell">
      <header className="app-hero">
        <h1>Koduck Flow Playground</h1>
        <p>
          Explore the interactive flow renderer with nodes, connections, viewport controls, and
          runtime-driven behavior.
        </p>
      </header>

      <section className={showE2EHarness ? "app-grid" : "app-grid app-grid--single"}>
        <div className="app-primary">
          <div className="section-heading">
            <h2>Interactive Flow Demo</h2>
            <p>Experiment with nodes, connections, and runtime interactions in real time.</p>
          </div>
          <FlowDemo />
        </div>

        {showE2EHarness ? (
          <aside className="app-harness" aria-label="E2E Runtime Harness">
            <div className="section-heading">
              <h2>E2E Runtime Harness</h2>
              <p>
                Provides deterministic selectors and workflows for automated end-to-end scenarios.
              </p>
            </div>
            <E2ERuntimeHarness />
          </aside>
        ) : null}
      </section>
    </main>
  );
}

export default App;
