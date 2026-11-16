import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { PAGES } from './pages';
import { useApi } from './api';
import { Icon, Stat, Chart, Table, Collections, Experiments } from './ui';

const iso = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

function Page({ p, range, tick }) {
  const { data, err, loading } = useApi(p.special ? null : p.p, { from: iso(range), to: iso(0) }, tick);
  const v = data && p.b ? p.b(data) : {};
  return (
    <div className="py-6 flex flex-col gap-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Last {range} days</div>
        <h1 className="font-head text-3xl font-bold tracking-tight">{p.t}</h1>
      </div>
      {loading && <div className="font-mono text-xs text-on-surface-variant animate-pulse">Loading…</div>}
      {err && <div className="p-3 rounded bg-error-container text-on-error-container">{err}</div>}
      {p.special === 'experiments' && <Experiments />}
      {v.stats && <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{v.stats.map(([l, x]) => <Stat key={l} label={l} value={x} />)}</div>}
      {p.p === 'overview' && <Collections key={tick} />}
      <div className="grid lg:grid-cols-2 gap-4">{(v.charts || []).map((c) => <Chart key={c.title} {...c} />)}</div>
      {(v.tables || []).map((t) => <Table key={t.title} {...t} />)}
    </div>
  );
}

export default function App() {
  const [range, setRange] = useState(30);
  const [tick, setTick] = useState(0);
  return (
    <BrowserRouter>
      <header className="fixed top-0 inset-x-0 h-16 z-50 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/30 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Icon n="hub" c="text-primary" /><span className="font-head font-semibold uppercase tracking-tight text-lg">Nexus Telemetry</span>
          <span className="hidden md:flex items-center gap-2 px-2 py-1 rounded bg-surface-container border border-outline-variant/40 font-mono text-[10px] uppercase text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />Production</span>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setRange(d)} className={`px-3 py-1.5 rounded font-mono text-xs ${range === d ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>{d}d</button>))}
          <button onClick={() => setTick((t) => t + 1)} title="Refresh" className="p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant"><Icon n="refresh" /></button>
        </div>
      </header>
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest z-40 border-r border-outline-variant/30 overflow-y-auto p-2">
        <div className="px-2 py-1 mb-1 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Workspace Console</div>
        <nav className="flex flex-col gap-0.5">
          {PAGES.map((p) => (
            <NavLink key={p.k} to={'/' + p.k} end className={({ isActive }) => `flex items-center gap-2 px-2 py-2 rounded font-mono text-xs transition-all ${isActive ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
              <Icon n={p.i} />{p.t}</NavLink>))}
        </nav>
      </aside>
      <main className="pl-64 pt-16 min-h-screen"><div className="px-6 pb-8">
        <Routes>{PAGES.map((p) => <Route key={p.k} path={'/' + p.k} element={<Page p={p} range={range} tick={tick} />} />)}</Routes>
      </div></main>
    </BrowserRouter>
  );
}
