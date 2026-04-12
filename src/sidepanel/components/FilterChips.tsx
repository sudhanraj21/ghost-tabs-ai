interface FilterItem {
  id: string;
  label: string;
}

interface FilterChipsProps {
  filters: FilterItem[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  counts: Record<string, number>;
}

export default function FilterChips({ filters, activeFilter, onFilterChange, counts }: FilterChipsProps) {
  const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);
  
  return (
    <div className="filters">
      {filters.map(filter => {
        const count = filter.id === 'all' ? totalCount : (counts[filter.id] || 0);
        
        return (
          <button
            key={filter.id}
            className={`filter-chip ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
            {count > 0 && <span> ({count})</span>}
          </button>
        );
      })}
    </div>
  );
}
