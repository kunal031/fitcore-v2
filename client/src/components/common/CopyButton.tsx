import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** How long "Copied" stays up before the label returns. */
const COPIED_MS = 1600;

/**
 * Copy to the clipboard and report it on the control itself.
 *
 * Returns a flag that goes true for a moment after a successful copy, so the
 * button can say so where the user is already looking rather than through a
 * banner somewhere else on the page.
 *
 * The timer is cleared on unmount and before each new copy, so a second click
 * restarts the window instead of the first one cutting it short.
 */
export function useCopyFeedback(): {
	copied: boolean;
	copy: (text: string) => Promise<boolean>;
} {
	const [copied, setCopied] = useState(false);
	const timer = useRef<number | undefined>(undefined);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const copy = useCallback(async (text: string) => {
		try {
			// Absent over plain http on anything but localhost, so this can be
			// undefined in the wild rather than merely reject.
			if (!navigator.clipboard) return false;
			await navigator.clipboard.writeText(text);
			window.clearTimeout(timer.current);
			setCopied(true);
			timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
			return true;
		} catch {
			// A denied permission should leave the control unchanged rather than
			// claiming a copy that did not happen.
			return false;
		}
	}, []);

	return { copied, copy };
}

/**
 * A copy control that turns into "Copied" for a moment after being pressed.
 *
 * `label` absent makes it icon-only, for places where a word would crowd the
 * row it sits in.
 */
export default function CopyButton({
	value,
	label,
	className = "outline-button compact-button",
	title,
}: {
	value: string;
	label?: string;
	className?: string;
	title?: string;
}) {
	const { copied, copy } = useCopyFeedback();
	const iconOnly = label === undefined;

	return (
		<button
			className={copied ? `${className} is-copied` : className}
			onClick={() => void copy(value)}
			// The accessible name changes with the state, so a screen reader hears
			// the confirmation that sighted users see.
			aria-label={iconOnly ? (copied ? "Copied" : title ?? "Copy") : undefined}
			title={title}
		>
			{copied ? <Check size={iconOnly ? 18 : 14} /> : <Copy size={iconOnly ? 18 : 14} />}
			{!iconOnly && (copied ? "Copied" : label)}
		</button>
	);
}
