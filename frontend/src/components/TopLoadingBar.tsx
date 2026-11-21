/**
 * Top Network Progress Bar Component (Nielsen Heuristic #1: Visibility of System Status).
 *
 * Automatically displays a smooth emerald loading indicator at the top of the
 * viewport whenever one or more API requests are in flight.
 *
 * @module components/TopLoadingBar
 */

import { useEffect, useState } from "react";
import { subscribeNetworkLoading } from "../services/apiClient";

/**
 * Renders an accessible top progress bar while network requests are active.
 */
export function TopLoadingBar() {
  const [activeCount, setActiveCount] = useState<number>(0);

  useEffect(() => {
    return subscribeNetworkLoading(setActiveCount);
  }, []);

  if (activeCount <= 0) return null;

  return (
    <div
      className="top-progress-track"
      role="progressbar"
      aria-label="Loading data"
    >
      <div className="top-progress-bar" />
    </div>
  );
}
