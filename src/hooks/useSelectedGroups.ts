import { useState, useEffect } from "react";

const STORAGE_KEY = "selected-groups-for-stats";

export function useSelectedGroups() {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedGroupIds));
  }, [selectedGroupIds]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const selectAll = (groupIds: string[]) => {
    setSelectedGroupIds(groupIds);
  };

  const clearSelection = () => {
    setSelectedGroupIds([]);
  };

  const isSelected = (groupId: string) => selectedGroupIds.includes(groupId);

  return {
    selectedGroupIds,
    toggleGroup,
    selectAll,
    clearSelection,
    isSelected,
  };
}
