"use client";

import type { ChangeTypeGroup, Material } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ComplianceBadge } from "@/components/ui/ComplianceBadge";
import { CheckboxCard } from "@/components/ui/CheckboxCard";
import { InfoBox } from "@/components/ui/InfoBox";

export function Step2Materials({
  changeTypeGroup,
  materials,
  selectedIds,
  onToggle,
}: {
  changeTypeGroup: ChangeTypeGroup;
  materials: Material[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const selectedCount = selectedIds.length;
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div>
        <p className="eyebrow">
          MLR-approved materials — {changeTypeGroup}
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
            subtitle={`${m.category} · ${m.owner} · ${formatDate(m.reviewed_at)}`}
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
