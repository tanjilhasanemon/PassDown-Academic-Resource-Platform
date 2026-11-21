import { useEffect, useState } from "react";
import { subscribeNetworkLoading } from "../api/client";

export function TopLoadingBar() {
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    return subscribeNetworkLoading(setActiveCount);
  }, []);

  if (activeCount <= 0) return null;

  return (
    <div className="top-progress-track" role="progressbar" aria-label="Loading data">
      <div className="top-progress-bar" />
    </div>
  );
}
