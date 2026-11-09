/** An editable table for one Parivar list (Kavach types, Gacha machines and rewards, chests, shop, tasks...). Save sends every row; the server checks them. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Button, Card, ErrorNote, Loading } from "./ui";

export type ColDef = { key: string; label: string; type: "text" | "int" | "bool" | "enum"; options?: string[]; width?: string; hint?: string };
type Row = Record<string, string | number | boolean | null> & { id?: number };

const base = "/api/v1/admin/parivar/cfg";

export function ConfigTable({ section, title, note, cols, blank, canSave, deletable = false, parent }: { section: string; title: string; note?: string; cols: ColDef[]; blank: Row; canSave: boolean; deletable?: boolean; parent?: { key: string; value: number } }) {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const l = await apiRequest<Row[]>(`${base}/${section}${parent ? `?parent=${parent.value}` : ""}`);
      setRows(l);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, [section, parent]);
  useEffect(() => {
    void load();
  }, [load]);

  const set = (i: number, key: string, v: string | number | boolean | null) => {
    setRows((r) => (r ?? []).map((x, j) => (j === i ? { ...x, [key]: v } : x)));
    setDirty(true);
  };

  const save = async () => {
    if (!rows) return;
    if (!window.confirm(`Save "${title}"? It applies to every Parivar at once.`)) return;
    setBusy(true);
    try {
      const body = rows.map((r) => ({ ...r, ...(parent ? { [parent.key]: parent.value } : {}) }));
      await apiRequest(`${base}/${section}`, { method: "PUT", body });
      toast(`${title} saved`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (i: number) => {
    const r = rows?.[i];
    if (!r) return;
    if (r.id === undefined) return setRows((l) => (l ?? []).filter((_, j) => j !== i));
    if (!window.confirm("Delete this row? It can't be undone.")) return;
    try {
      await apiRequest(`${base}/${section}/${r.id}`, { method: "DELETE" });
      toast("Deleted");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete", "error");
    }
  };

  return (
    <Card
      className="mt-4"
      title={title}
      action={
        <Button
          size="sm"
          disabled={!canSave || !rows}
          onClick={() => {
            setRows((r) => [...(r ?? []), { ...blank }]);
            setDirty(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      }
    >
      {note ? <p className="px-4 pt-3 text-xs text-muted">{note}</p> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!rows ? (
        <Loading />
      ) : (
        <div className="scroll-thin overflow-x-auto px-4 pb-4">
          <table className="mt-2 text-sm" style={{ minWidth: cols.length * 110 }}>
            <thead className="text-[11px] tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 pr-2 text-left font-bold">ID</th>
                {cols.map((c) => (
                  <th key={c.key} className="py-2 pr-2 text-left font-bold" title={c.hint}>
                    {c.label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? `n${i}`} className="align-top">
                  <td className="py-1 pr-2 font-mono text-xs text-muted">{r.id ?? "new"}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="py-1 pr-2">
                      {c.type === "bool" ? (
                        <input type="checkbox" disabled={!canSave} checked={Boolean(r[c.key])} onChange={(e) => set(i, c.key, e.target.checked)} aria-label={c.label} />
                      ) : c.type === "enum" ? (
                        <select className="field h-9 py-1 text-sm" disabled={!canSave} value={String(r[c.key] ?? "")} onChange={(e) => set(i, c.key, e.target.value)} aria-label={c.label}>
                          {c.options?.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field h-9 py-1 text-sm"
                          style={{ width: c.width ?? (c.type === "int" ? "92px" : "150px") }}
                          inputMode={c.type === "int" ? "numeric" : "text"}
                          disabled={!canSave}
                          value={r[c.key] === null || r[c.key] === undefined ? "" : String(r[c.key])}
                          onChange={(e) => set(i, c.key, c.type === "int" ? (e.target.value.replace(/\D/g, "") === "" ? "" : Number(e.target.value.replace(/\D/g, ""))) : e.target.value)}
                          aria-label={c.label}
                        />
                      )}
                    </td>
                  ))}
                  <td className="py-1">
                    {(deletable || r.id === undefined) && canSave ? (
                      <Button size="sm" variant="danger" onClick={() => void remove(i)} aria-label="Delete row">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-end">
            <Button variant="gold" busy={busy} disabled={!canSave || !dirty} onClick={save}>
              Save {title.toLowerCase()}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
