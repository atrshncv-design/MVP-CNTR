"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./modal";
import { Button } from "./button";

export function Confirm({
  open,
  title,
  description,
  confirmLabel,
  variant = "danger",
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const t = useTranslations("dashboard");
  const descId = React.useId();
  return (
    <Modal open={open} onClose={onCancel} title={title} ariaDescribedBy={description ? descId : undefined}>
      {description ? (
        <p id={descId} className="text-sm text-tz-secondary">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t("uiCancel")}
        </Button>
        <Button type="button" variant={variant} onClick={onConfirm} loading={loading} autoFocus>
          {confirmLabel ?? t("uiConfirmDefault")}
        </Button>
      </div>
    </Modal>
  );
}
