// Implementation of Tabs component using Radix UI
import React from 'react';
import { cn } from "@/lib/utils";

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

interface TabsTriggerProps {
  value: string;
  currentValue: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ children }) => {
  return (
    <div className="w-full">{children}</div>
  );
};

export const TabsList: React.FC<TabsListProps> = ({ className, children }) => {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
        className
      )}
    >
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ 
  value, 
  currentValue, 
  onClick, 
  className, 
  children 
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium",
        "transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-white data-[state=active]:text-gray-950 data-[state=active]:shadow-sm",
        "dark:data-[state=active]:bg-gray-950 dark:data-[state=active]:text-gray-50",
        className
      )}
      data-state={currentValue === value ? "active" : "inactive"}
    >
      {children}
    </button>
  );
}; 