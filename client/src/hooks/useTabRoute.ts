/**
 * Backs a tab by the URL instead of component state.
 *
 * The dashboard was built around a `tab` string held in `useState`, which left
 * every view sharing one address: no bookmarking, no deep links, and the
 * browser back button exited the app rather than returning to the previous
 * tab.
 *
 * This keeps the same `[tab, setTab]` shape the components already use, so
 * they need no changes, while reading from and writing to the path.
 */
import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export interface TabRouteOptions<T extends string> {
  /** Every tab that may appear in the URL. */
  validTabs: readonly T[];
  /** Where an unknown or missing segment lands. */
  fallback: T;
  /** Path prefix the tabs live under, e.g. "/app". */
  basePath: string;
}

export function useTabRoute<T extends string>({
  validTabs,
  fallback,
  basePath,
}: TabRouteOptions<T>): [T, (tab: T) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  // "/app/plans" -> "plans". An unrecognised segment falls back rather than
  // rendering nothing, so a stale bookmark still opens the app.
  const segment = location.pathname.slice(basePath.length).replace(/^\//, "").split("/")[0] ?? "";
  const isKnown = (validTabs as readonly string[]).includes(segment);
  const tab = isKnown ? (segment as T) : fallback;

  // A URL that does not name a real tab (a bare /app, or a member path a staff
  // account cannot open) is rewritten to the tab actually being shown, so the
  // address bar never disagrees with the screen.
  useEffect(() => {
    if (!isKnown) navigate(`${basePath}/${fallback}`, { replace: true });
  }, [isKnown, basePath, fallback, navigate]);

  const setTab = useCallback(
    (next: T) => {
      const target = `${basePath}/${next}`;
      if (location.pathname !== target) navigate(target);
    },
    [basePath, location.pathname, navigate],
  );

  return [tab, setTab];
}
