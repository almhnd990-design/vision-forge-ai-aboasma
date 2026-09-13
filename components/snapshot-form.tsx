"use client";
import { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { getDictionary, Locale } from "@/lib/i18n/dictionaries";
import type { BusinessSnapshot } from "@/lib/agent/types";
import { snapshotSchema } from "@/lib/workspace";
export function SnapshotForm({
  locale,
  initial,
  onSave,
  onCancel,
}: {
  locale: Locale;
  initial?: BusinessSnapshot;
  onSave: (snapshot: BusinessSnapshot) => void;
  onCancel: () => void;
}) {
  const t = getDictionary(locale).dash;
  const [charges, setCharges] = useState(
    initial?.duplicateChargeCandidates.map((c) => ({
      ...c,
      amount: String(c.amountCents / 100),
    })) ?? [],
  );
  const [error, setError] = useState("");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const cents = (v: string) =>
      /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : NaN;
    const result = snapshotSchema.safeParse({
      workspaceId: form.get("workspace"),
      revenueCents: cents(String(form.get("revenue"))),
      previousRevenueCents: cents(String(form.get("previous"))),
      refundPendingCents: cents(String(form.get("refund"))),
      inventoryDays:
        form.get("inventory") === ""
          ? undefined
          : Number(form.get("inventory")),
      duplicateChargeCandidates: charges.map((c) => ({
        id: c.id,
        description: c.description,
        amountCents: cents(c.amount),
      })),
    });
    if (!result.success) {
      setError(t.invalid);
      return;
    }
    onSave(result.data);
  }
  return (
    <form onSubmit={submit} className="snapshot-form">
      <p className="muted">{t.dataCopy}</p>
      <div className="form-grid">
        {[
          ["workspace", initial?.workspaceId ?? "", "text"],
          ["revenue", initial ? initial.revenueCents / 100 : "", "number"],
          [
            "previous",
            initial ? initial.previousRevenueCents / 100 : "",
            "number",
          ],
          ["refund", initial ? initial.refundPendingCents / 100 : "", "number"],
          ["inventory", initial?.inventoryDays ?? "", "number"],
        ].map(([name, value, type], i) => (
          <label key={name} className={i === 0 ? "full-field" : ""}>
            <span>{t.fields[i]}</span>
            <input
              name={String(name)}
              defaultValue={value}
              type={String(type)}
              required={i !== 4}
              min={type === "number" ? 0 : undefined}
              max={
                type === "number" ? (i === 4 ? 10000 : 1000000000) : undefined
              }
              maxLength={i === 0 ? 80 : undefined}
              step={type === "number" ? "0.01" : undefined}
              placeholder={i === 0 ? t.workspace : "0.00"}
            />
          </label>
        ))}
      </div>
      <div className="form-subhead">
        <h3>{t.duplicate}</h3>
        <button
          type="button"
          className="text-button"
          disabled={charges.length >= 50}
          onClick={() =>
            setCharges([
              ...charges,
              {
                id: crypto.randomUUID(),
                description: "",
                amount: "",
                amountCents: 0,
              },
            ])
          }
        >
          <Plus size={15} />
          {t.addCharge}
        </button>
      </div>
      <p className="small muted">{t.duplicateCopy}</p>
      {charges.map((c, i) => (
        <div className="charge-row" key={c.id}>
          <label>
            <span>{t.description}</span>
            <input
              aria-label={`${t.description} ${i + 1}`}
              value={c.description}
              required
              maxLength={300}
              onChange={(e) =>
                setCharges(
                  charges.map((v) =>
                    v.id === c.id ? { ...v, description: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            <span>{t.amount}</span>
            <input
              type="number"
              min="0.01"
              max="1000000000"
              step="0.01"
              required
              value={c.amount}
              onChange={(e) =>
                setCharges(
                  charges.map((v) =>
                    v.id === c.id ? { ...v, amount: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="icon-button danger"
            aria-label={`${t.remove} ${i + 1}`}
            onClick={() => setCharges(charges.filter((v) => v.id !== c.id))}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={onCancel}
        >
          {t.cancel}
        </button>
        <button className="button button-primary" type="submit">
          <Sparkles size={17} />
          {t.save}
        </button>
      </div>
    </form>
  );
}
