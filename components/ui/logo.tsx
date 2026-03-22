"use client";
import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Logo({ className = "", size = "md" }: LogoProps) {
  // Define dimensions based on size prop if needed, or just use className
  const sizeClasses = {
    sm: "h-6",
    md: "h-10",
    lg: "h-12",
    xl: "h-16",
  };

  const finalClassName = `${sizeClasses[size]} ${className}`;

  return (
    <div className={`flex items-center gap-2 ${finalClassName}`}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto flex-shrink-0"
      >
        {/* Stylized Geometric Icon - Composed of Diamond Shapes */}
        <path
          d="M20 5L32 17L20 29L8 17L20 5Z"
          fill="#163832"
          className="fill-[var(--brand-primary)]"
        />
        <path
          d="M20 12L28 20L20 28L12 20L20 12Z"
          fill="#235347"
          className="fill-[var(--brand-secondary)]"
        />
        <path
          d="M20 17L24 21L20 25L16 21L20 17Z"
          fill="#8EB69B"
          className="fill-[var(--muted-green)]"
        />
        <path
          d="M20 2L23 5L20 8L17 5L20 2Z"
          fill="#DAF1DE"
          className="fill-[var(--pastel-mint)]"
        />
      </svg>
      
      <span 
        className="font-serif italic font-bold text-2xl tracking-tight text-[#163832] dark:text-white"
        style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
      >
        WORQS
      </span>
    </div>
  );
}
