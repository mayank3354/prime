export function ResearchResults({ results }) {
  if (!results) {
    return <div>No results available</div>;
  }
  
  return (
    <div>
      <h2>{results.summary || 'No summary available'}</h2>
      {/* Rest of the component */}
    </div>
  );
} 