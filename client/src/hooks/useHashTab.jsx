import { useState, useEffect } from "react";

export function useHashTab(defaultTab) {
  const getHash = () =>
    decodeURIComponent(window.location.hash.slice(1)) || defaultTab;

  const [activeTab, setActiveTabState] = useState(getHash);

  const setActiveTab = (tab) => {
    if (tab !== getHash()) {
      window.history.pushState(null, "", "#" + encodeURIComponent(tab));
    }
    setActiveTabState(tab);
  };

  useEffect(() => {
    const onPop = () => setActiveTabState(getHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    setActiveTabState(getHash());
  }, []);

  return [activeTab, setActiveTab];
}