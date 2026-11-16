import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApi } from './api';

const COL = ['#4cd7f6', '#4edea3', '#d0bcff', '#ffb4ab'];
export const Icon = ({ n, c = '' }) => <span className={`material-symbols-outlined ${c}`}>{n}</span>;

export const fmt = (v, k = '') => {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);
  if (/ms$/i.test(k) && Math.abs(v) >= 1000) return v >= 60000 ? (v / 60000).toFixed(1) + 'm' : (v / 1000).toFixed(1) + 's';
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
const head = (k) => k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
// flatten Mongo group rows: { _id: {a,b}, x } -> { a, b, x };  { _id: 'foo' } -> { name: 'foo' }
const flat = (r) => {
  const o = {};
  for (const [k, v] of Object.entries(r)) {
    if (Array.isArray(v)) continue;
    if (v && typeof v === 'object') Object.assign(o, flat(v)); else o[k === '_id' ? 'name' : k] = v;
  }
  return o;
};

export const Card = ({ title, icon = 'monitoring', right, children }) => (
  <section className="rounded bg-surface-container-low shadow-md overflow-hidden">
    <div className="p-4 bg-surface-container flex items-center justify-between gap-3">
      <span className="font-head font-semibold flex items-center gap-2"><Icon n={icon} c="text-primary" />{title}</span>{right}
    </div>{children}
  </section>
);

export const Stat = ({ label, value }) => (
  <div className="p-4 rounded bg-surface-container-low shadow-md relative overflow-hidden">
    <div className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">{label}</div>
    <div className="font-mono text-[28px] leading-8 font-bold mt-2 truncate">{typeof value === 'number' ? fmt(value) : value ?? '—'}</div>
    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary to-transparent opacity-60" />
  </div>
);

export function Chart({ title, type = 'line', data = [], keys }) {
  if (!data.length) return null;
  const ks = keys || Object.keys(data[0]).filter((k) => k !== 'name');
  const C = type === 'bar' ? BarChart : LineChart;
  return (
    <Card title={title}><div className="p-4 h-64"><ResponsiveContainer>
      <C data={data}><CartesianGrid stroke="#31353e" vertical={false} />
        <XAxis dataKey="name" stroke="#869397" fontSize={11} /><YAxis stroke="#869397" fontSize={11} />
        <Tooltip contentStyle={{ background: '#1c2028', border: '1px solid #3d494c', fontSize: 12 }} />
        {ks.map((k, i) => type === 'bar' ? <Bar key={k} dataKey={k} fill={COL[i % 4]} /> : <Line key={k} dataKey={k} stroke={COL[i % 4]} dot={false} strokeWidth={2} />)}
      </C></ResponsiveContainer></div></Card>
  );
}

export function Table({ title, rows = [], icon = 'table_rows', right }) {
  const R = rows.map(flat);
  if (!R.length) return null;
  const cols = Object.keys(R[0]);
  return (
    <Card title={title} icon={icon} right={right}><div className="overflow-x-auto"><table className="w-full text-left">
      <thead><tr className="bg-surface-container-lowest font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        {cols.map((c) => <th key={c} className="py-3 px-4">{head(c)}</th>)}</tr></thead>
      <tbody>{R.map((r, i) => <tr key={i} className={`hover:bg-surface-container ${i % 2 ? 'bg-surface-container-lowest/40' : ''}`}>
        {cols.map((c) => <td key={c} className={`py-2.5 px-4 font-mono text-xs ${c === 'name' ? 'text-primary font-bold' : ''}`}>{fmt(r[c], c)}</td>)}</tr>)}</tbody>
    </table></div></Card>
  );
}

// Overview: live document counts per collection (GET /analytics/collections)
export function Collections() {
  const { data = [] } = useApi('collections');
  const [q, setQ] = useState('');
  const rows = data.filter((r) => (r.name + r.purpose).toLowerCase().includes(q.toLowerCase())).map((r, i) => ({ '#': i + 1, name: r.name, purpose: r.purpose, documents: r.count }));
  return <Table title={`Registered Data Collections (${data.length})`} icon="dataset" rows={rows}
    right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter collections…"
      className="bg-surface-container-lowest rounded px-3 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-primary" />} />;
}

// A/B testing: pick an experiment -> per-variant results
export function Experiments() {
  const { data: list = [], err } = useApi('experiments');
  const [id, setId] = useState('');
  const { data: res, loading } = useApi(id ? `experiments/${id}/results` : null);
  return (
    <div className="flex flex-col gap-4">
      {err && <div className="p-3 rounded bg-error-container text-on-error-container">{err}</div>}
      <Table title="Experiments" icon="science" rows={list.map(({ experiment_id, experiment_name, status, start_date, end_date }) => ({ experiment_id, experiment_name, status, start_date, end_date }))} />
      <select value={id} onChange={(e) => setId(e.target.value)} className="self-start bg-surface-container rounded px-3 py-2 font-mono text-xs outline-none">
        <option value="">Select experiment for results…</option>{list.map((e) => <option key={e.experiment_id} value={e.experiment_id}>{e.experiment_name}</option>)}
      </select>
      {loading && <div className="font-mono text-xs animate-pulse">Loading…</div>}
      {res && <><Chart type="bar" title="Conversion rate % by variant" data={res.variants.map((v) => ({ name: v.variant_id, conversionRate: v.conversionRate, winRate: v.winRate }))} />
        <Table title="Variant results" rows={res.variants} /><p className="text-xs text-on-surface-variant">{res.note}</p></>}
    </div>
  );
}
