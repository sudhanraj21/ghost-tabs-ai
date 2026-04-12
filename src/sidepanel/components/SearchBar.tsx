interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="search-container">
      <input
        type="text"
        className="search-input"
        placeholder="Search ghost tabs..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
