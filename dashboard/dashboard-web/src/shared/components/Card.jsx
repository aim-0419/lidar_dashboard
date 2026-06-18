import React from "react";

// 여러 페이지에서 재사용하는 공통 카드 컴포넌트이다.
// title이 있으면 카드 상단에 제목 영역을 표시하고, children에는 실제 내용을 넣는다.
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
