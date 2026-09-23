import { useEffect, useRef } from "react";

/**
 * Modal confirmation, for actions worth a second look.
 *
 * Rendered only while `open`, so the dialog holds no state between openings
 * and the caller needs no reset. Escape and a backdrop click both cancel,
 * matching what a native dialog does.
 */
export default function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = "Yes",
	cancelLabel = "No",
	onConfirm,
	onCancel,
}: {
	open: boolean;
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const confirmRef = useRef<HTMLButtonElement>(null);

	// Escape closes from anywhere, including before focus has landed inside.
	useEffect(() => {
		if (!open) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") onCancel();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onCancel]);

	// Focus the confirm button so the dialog is operable from the keyboard the
	// moment it opens, rather than leaving focus behind on the trigger.
	useEffect(() => {
		if (open) confirmRef.current?.focus();
	}, [open]);

	if (!open) return null;

	return (
		<div
			className="modal-backdrop"
			// A click that starts inside the card and drags out should not close
			// it, so this fires only when the backdrop itself is the target.
			onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
		>
			<div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
				<h2 id="confirm-dialog-title">{title}</h2>
				{message && <p className="muted">{message}</p>}
				<div className="modal-actions">
					<button className="modal-button" onClick={onCancel}>{cancelLabel}</button>
					<button ref={confirmRef} className="modal-button modal-button-primary" onClick={onConfirm}>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
