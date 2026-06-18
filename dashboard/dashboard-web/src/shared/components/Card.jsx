import React from "react";

export function Card({ children, className = "", title }) {
  return (
    <div
      className={`bg-gray-50 border-2 border-dashed border-gray-300 p-4 rounded-lg ${className}`}
    >
      {title && (
        <div className="mb-4 pb-2 border-b-2 border-dashed border-gray-200">
          <h3 className="font-mono text-gray-500 font-bold uppercase tracking-wider text-sm">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
}
