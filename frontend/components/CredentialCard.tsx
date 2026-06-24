// The credential — the core artefact. Revealed claims show a category value;
// everything else stays Private. Raw personal data is never rendered.

import { IconLock } from "@tabler/icons-react";
import { Badge } from "./Badge";
import { truncateHash } from "@/lib/format";

export interface CardField {
  label: string;
  value: string | null; // null => kept private
}

interface Props {
  issuer: string;
  type: string;
  holder: string;
  network?: string;
  fields: CardField[];
  proofHash?: string;
  validity?: string;
}

export function CredentialCard({
  issuer,
  type,
  holder,
  network = "stellar:testnet",
  fields,
  proofHash,
  validity,
}: Props) {
  return (
    <div
      className="card"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.025), transparent 40%), var(--card)",
        maxWidth: 420,
      }}
    >
      <div className="between" style={{ marginBottom: "1.5rem" }}>
        <span className="eyebrow">{issuer}</span>
        <Badge variant="verified">Verified</Badge>
      </div>

      <h2 style={{ marginBottom: "0.4rem" }}>{type}</h2>
      <div className="mono faint" style={{ marginBottom: "1.5rem" }}>
        {holder} · {network}
      </div>

      <div className="stack">
        {fields.map((f) => (
          <div className="line" key={f.label}>
            <span className="muted">{f.label}</span>
            {f.value ? (
              <span className="mono accent">{f.value}</span>
            ) : (
              <span
                className="row faint"
                style={{ gap: "0.3rem", fontSize: "0.8125rem" }}
              >
                <IconLock size={13} />
                Private
              </span>
            )}
          </div>
        ))}
      </div>

      {(proofHash || validity) && (
        <>
          <hr className="divider" />
          <div className="between">
            <span className="mono faint">
              {proofHash ? truncateHash(proofHash) : "—"}
            </span>
            {validity && <span className="mono accent">{validity}</span>}
          </div>
        </>
      )}
    </div>
  );
}
