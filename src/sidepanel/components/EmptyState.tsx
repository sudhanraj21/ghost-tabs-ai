interface EmptyStateProps {
  ghostCount: number;
}

export default function EmptyState({ ghostCount }: EmptyStateProps) {
  if (ghostCount === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👻</div>
        <h3>Your Ghost Shelf is empty</h3>
        <p>
          Park tabs to save them here and free up memory.
          Double-click the floating icon on any page to park it instantly.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">🔍</div>
      <h3>No matching tabs</h3>
      <p>
        Try adjusting your search or filter to find what you're looking for.
      </p>
    </div>
  );
}
