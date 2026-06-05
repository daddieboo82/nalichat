import { useEffect } from 'react';
import { base44 } from "@/api/base44Client";

import { useState } from 'react';

export default function FindSplit() {
  const [results, setResults] = useState([]);
  useEffect(() => {
    async function search() {
      const modules = import.meta.glob('/src/**/*.{js,jsx}', { as: 'raw' });
      const found = [];
      for (const path in modules) {
        const content = await modules[path]();
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('.split(')) {
            found.push(`${path}:${i + 1}: ${line.trim()}`);
          }
        });
      }
      
      setResults(found);
    }
    search();
  }, []);

  return (
    <div className="p-8 bg-black text-white h-screen overflow-auto font-mono text-sm relative z-50">
      <h1 className="mb-4 text-xl">Split Search Results</h1>
      {results.map((res, i) => (
        <div key={i}>{res}</div>
      ))}
    </div>
  );
}