"use client";

import type { ConflictType, Material } from "@/data/synthetic";
import { CONFLICT_TYPE_LABEL } from "@/data/synthetic";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";
import { CheckboxCard } from "@/components/ui/CheckboxCard";
import { InfoBox } from "@/components/ui/InfoBox";

export function Step2Materials({
  conflictType,
  materials,
  selectedIds,
  onToggle,
}: {
  conflictType: ConflictType;
  materials: Material[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const selectedCount = selectedIds.length;
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div>
        <p className="eyebrow">
          MLR-approved materials — {CONFLICT_TYPE_LABEL[conflictType]}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
          All relevant materials are pre-selected. Deselect any you wish to
          exclude. Only compliance-reviewed assets are available.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {materials.map((m) => (
          <CheckboxCard
            key={m.id}
            checked={selectedIds.includes(m.id)}
            onChange={() => onToggle(m.id)}
            title={m.title}
            subtitle={`${m.category} · ${m.owner} · ${m.date}`}
            right={<ComplianceBadge />}
          />
        ))}
      </div>

      <InfoBox variant="gray">
        {selectedCount} material{selectedCount === 1 ? "" : "s"} will be
        attached. No promotional or non-approved content is selectable.
      </InfoBox>
    </div>
  );
}
